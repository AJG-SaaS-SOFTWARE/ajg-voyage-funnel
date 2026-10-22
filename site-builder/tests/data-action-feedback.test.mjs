import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";

const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
const site = { id: "site-synthetic", slug: "synthetic", config: { brandName: "Synthetic studio" } };
function nodes(value) {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !value.props) return [];
  return [value, ...nodes(value.props.children)];
}
function words(value) {
  if (Array.isArray(value)) return value.map(words).join("");
  if (typeof value === "string") return value;
  return value?.props ? words(value.props.children) : "";
}
function harness() {
  const state = [];
  const refs = [];
  const writes = [];
  let cursor = 0, refCursor = 0, effect, started = false, failRefresh = false, failWrite = false, reads = 0;
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
    },
    useRef(initial) {
      const index = refCursor++;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index];
    },
    useCallback: callback => callback,
    useMemo: callback => callback(),
    useEffect: callback => { effect = callback; }
  };
  const code = ts.transpileModule(fs.readFileSync(new URL("../app/data/page.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText;
  const loaded = { exports: {} };
  const dependencies = {
    react: hooks, "react/jsx-runtime": jsx,
    "../../components/AccountShell": { AccountShell: () => null },
    "../../components/CustomerErrorHelp": { CustomerErrorHelp: () => null },
    "../../lib/product-i18n": { useProductLocale: () => ({ locale: "fr", tr: fr => fr }) },
    "../../lib/billing-access": {},
    "../../lib/site-recovery": { siteConfigFromRecoveryExport: () => ({ source: "published", exportedAt: null, config: { heroTitle: "Recovered" } }) },
    "../../lib/data-rights": {
      getMyErasureRequests: async () => [],
      requestDataErasure: async input => { writes.push(input); if (failWrite) throw new Error("Write rejected"); }
    },
    "../../lib/supabase-site-repository": {
      getCurrentUser: async () => ({ email: "owner@example.test" }),
      getMySites: async () => { reads++; if (failRefresh) throw new Error("Read failed"); return [site]; },
      saveMySite: async (config, publish, id) => { writes.push({ config, publish, id }); if (failWrite) throw new Error("Write rejected"); }
    }
  };
  new Function("require", "module", "exports", "window", code)(name => {
    assert.ok(name in dependencies, name); return dependencies[name];
  }, loaded, loaded.exports, { confirm: () => true, setTimeout, clearTimeout });
  let tree;
  return {
    state, writes, reads: () => reads,
    failRefresh(value) { failRefresh = value; }, failWrite(value) { failWrite = value; },
    render() { cursor = 0; refCursor = 0; tree = loaded.exports.default(); if (!started) { started = true; effect(); } return tree; },
    button(label) { return nodes(tree).find(node => node.type === "button" && words(node) === label); },
    help() { return nodes(tree).find(node => node.type?.name === "CustomerErrorHelp")?.props.message; },
    file() { return nodes(tree).find(node => node.type === "input" && node.props.type === "file"); },
    async restore() { this.file().props.onChange({ currentTarget: { files: [{ size: 100, text: async () => "{}" }], value: "file" } }); await flush(); this.render(); }
  };
}
async function page() { const h = harness(); h.render(); await flush(); h.render(); return h; }

test("successful restoration keeps its confirmation after the page reloads", async () => {
  const h = await page(); await h.restore();
  assert.match(h.state[6], /^Configuration restaurée dans un brouillon/);
  assert.equal(h.state[7], "");
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].publish, false);
  assert.equal(h.writes[0].id, site.id);
  assert.equal(h.help(), null);
});

test("refresh failures preserve restoration success and a read-only retry never saves twice", async () => {
  const h = await page(); h.failRefresh(true); await h.restore();
  assert.match(h.state[6], /^Configuration restaurée/);
  assert.match(h.state[6], /actualisation/);
  assert.equal(h.file().props.disabled, true);
  assert.equal(h.help(), null);
  assert.ok(h.button("Réessayer l’actualisation"));
  h.failRefresh(false);
  h.button("Réessayer l’actualisation").props.onClick(); await flush(); h.render();
  assert.equal(h.writes.length, 1);
  assert.equal(h.reads(), 3);
  assert.equal(h.state[7], "");
  assert.equal(h.button("Réessayer l’actualisation"), undefined);
  assert.match(h.state[6], /^Configuration restaurée/);
});

test("recorded site and account erasure requests remain successful when only refresh fails", async () => {
  for (const scope of ["site", "account"]) {
    const h = await page();
    if (scope === "site") h.state[3] = { [site.id]: site.slug };
    else h.state[4] = "owner@example.test";
    h.render(); h.failRefresh(true);
    const label = scope === "site" ? "Demander l’effacement" : "Demander la suppression du compte";
    h.button(label).props.onClick(); await flush(); h.render();
    assert.equal(h.writes.length, 1);
    assert.equal(h.writes[0].scope, scope);
    assert.match(h.state[6], /enregistrée/);
    assert.equal(h.button(label).props.disabled, true);
    h.failRefresh(false);
    h.button("Réessayer l’actualisation").props.onClick(); await flush(); h.render();
    assert.equal(h.writes.length, 1);
    assert.equal(h.state[7], "");
    assert.match(h.state[6], /enregistrée/);
  }
});

test("a rejected mutation stays an error and does not pretend to be a refresh failure", async () => {
  const h = await page(); h.failWrite(true); await h.restore();
  assert.equal(h.state[6], "Write rejected");
  assert.equal(h.help(), "Write rejected");
  assert.equal(h.state[7], "");
  assert.equal(h.reads(), 1);
  assert.equal(h.button("Réessayer l’actualisation"), undefined);
});
