import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";
import { runDomainAction } from "../lib/domain-action-result.ts";

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL("../app/domains/page.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX
} }).outputText;
const settle = () => new Promise(resolve => setImmediate(resolve));
function nodes(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  if (!tree || typeof tree !== "object") return [];
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join("");
  return typeof tree === "string" ? tree : tree && typeof tree === "object" ? text(tree.props?.children) : "";
}
function harness(locale = "fr") {
  const values = [];
  let index = 0, mounted = false;
  const effects = [];
  const state = { refreshFails: false, removeFails: false, removes: 0, requests: 0, syncs: 0, reads: 0,
    domains: [{ id: "domain-a", hostname: "example.test", kind: "custom_domain", verificationStatus: "pending" }],
    sites: [{ id: "site-a", slug: "a" }, { id: "site-b", slug: "b" }] };
  const tr = (fr, en) => locale === "en" ? en : fr;
  const ErrorHelp = () => null;
  const imports = {
    react: {
      useState(initial) { const at = index++; if (!(at in values)) values[at] = initial; return [values[at], value => { values[at] = value; }]; },
      useRef(initial) { const at = index++; if (!(at in values)) values[at] = { current: initial }; return values[at]; },
      useEffect(effect) { if (!mounted) effects.push(effect); }
    },
    "../../components/AccountShell": { AccountShell: () => null },
    "../../components/CustomerErrorHelp": { CustomerErrorHelp: ErrorHelp },
    "../../lib/product-i18n": { useProductLocale: () => ({ locale, tr }) },
    "../../lib/domain-guidance": { domainGuide: () => [] },
    "../../lib/domain-action-result": { runDomainAction },
    "../../lib/subscription": { freeEntitlements: { customDomain: false }, getMySiteEntitlements: async () => ({ customDomain: true }) },
    "../../lib/supabase-site-repository": {
      getMySites: async () => { state.reads++; if (state.refreshFails) throw Error("private provider detail"); return state.sites; },
      getMySite: async id => state.sites.find(site => site.id === id),
      getMyDomains: async () => state.domains,
      requestCustomDomain: async () => { state.requests++; return state.domains[0]; },
      syncSiteDomain: async () => { state.syncs++; return { verified: true, verification: [] }; },
      removeCustomDomain: async () => { state.removes++; if (state.removeFails) throw Error("lost response"); state.domains = []; }
    }
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(name => imports[name] ?? require(name), module, module.exports);
  const render = () => { index = 0; return module.exports.default(); };
  const button = (tree, label) => nodes(tree, node => node.type === "button" && text(node) === label)[0];
  return { state, render, button, ErrorHelp, async mount() {
    render(); mounted = true; for (const effect of effects) effect(); await settle(); return render();
  } };
}

for (const locale of ["fr", "en"]) {
  test(`domain page ${locale}: successful removal is not presented as an error`, async () => {
    const h = harness(locale); let tree = await h.mount();
    h.button(tree, locale === "fr" ? "Retirer" : "Remove").props.onClick(); await settle(); tree = h.render();
    assert.match(text(tree), locale === "fr" ? /Domaine retiré de la liste/ : /Domain removed from the list/);
    assert.equal(nodes(tree, node => node.type === h.ErrorHelp)[0].props.message, null);
    assert.equal(h.state.removes, 1);
  });
  test(`domain page ${locale}: accepted mutation + failed refresh blocks all actions, read-only retry does not replay`, async () => {
    const h = harness(locale); let tree = await h.mount();
    h.state.refreshFails = true;
    const remove = h.button(tree, locale === "fr" ? "Retirer" : "Remove");
    remove.props.onClick(); remove.props.onClick(); await settle(); tree = h.render();
    assert.equal(h.state.removes, 1);
    assert.match(text(tree), locale === "fr" ? /L’action a été confirmée/ : /The action was confirmed/);
    assert.equal(nodes(tree, node => node.type === "select")[0].props.disabled, true);
    assert.equal(nodes(tree, node => node.type === "input")[0].props.disabled, true);
    const form = nodes(tree, node => node.type === "form")[0];
    await form.props.onSubmit({ preventDefault() {} }); assert.equal(h.state.requests, 0);
    h.state.refreshFails = false;
    h.button(tree, locale === "fr" ? "Actualiser la liste sans relancer l’action" : "Refresh the list without resubmitting the action").props.onClick();
    await settle(); tree = h.render();
    assert.equal(h.state.removes, 1); assert.equal(h.state.syncs, 0);
    assert.equal(h.button(tree, locale === "fr" ? "Retirer" : "Remove"), undefined);
    assert.equal(nodes(tree, node => node.type === "select")[0].props.disabled, false);
  });
  test(`domain page ${locale}: lost mutation response does not claim failure or trigger another mutation`, async () => {
    const h = harness(locale); let tree = await h.mount(); h.state.removeFails = true;
    h.button(tree, locale === "fr" ? "Retirer" : "Remove").props.onClick(); await settle(); tree = h.render();
    assert.match(text(tree), locale === "fr" ? /Elle a peut-être été appliquée/ : /It may have been applied/);
    assert.equal(h.state.removes, 1);
    assert.equal(h.button(tree, locale === "fr" ? "Retirer" : "Remove").props.disabled, true);
    assert.doesNotMatch(text(tree), /private provider detail|lost response/);
  });
}

test("a failed site switch keeps the prior coherent selection instead of falling back to another site", async () => {
  const h = harness(); let tree = await h.mount(); h.state.sites = [h.state.sites[0]];
  nodes(tree, node => node.type === "select")[0].props.onChange({ target: { value: "site-b" } });
  await settle(); tree = h.render();
  assert.equal(nodes(tree, node => node.type === "select")[0].props.value, "site-a");
  assert.match(text(tree), /Aucune action n’a été relancée/);
  assert.equal(h.state.requests + h.state.removes + h.state.syncs, 0);
});
