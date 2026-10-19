import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const code = ts.transpileModule(fs.readFileSync(new URL("../app/billing/page.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

function fixture(openPortal, { locale = "fr", billingAccount = true, loading = false } = {}) {
  const state = [
    { state: "active", hasBillingAccount: billingAccount }, "",
    [{ id: "site-a", slug: "a" }, { id: "site-b", slug: "b" }], "site-a", false, loading
  ];
  let cursor = 0;
  const calls = [];
  const element = (type, props) => ({ type, props });
  const dependencies = {
    react: {
      useState(initial) {
        const index = cursor++; if (!(index in state)) state[index] = initial;
        return [state[index], value => { state[index] = value; }];
      },
      useRef(initial) {
        const index = cursor++; if (!(index in state)) state[index] = { current: initial };
        return state[index];
      },
      useEffect() {}
    },
    "react/jsx-runtime": { jsx: element, jsxs: element },
    "../../components/AccountShell": { AccountShell: "account-shell" },
    "../../lib/billing-access": {
      async openStripeBillingPortal(id) { calls.push(id); return openPortal(id); },
      downloadMySiteExport() { throw new Error("unexpected export"); },
      getMyBillingState() { throw new Error("unexpected billing read"); }
    },
    "../../lib/supabase-site-repository": { getMySites() { throw new Error("unexpected site read"); } },
    "../../lib/product-i18n": { useProductLocale: () => ({ locale, tr: (fr, en) => locale === "en" ? en : fr }) },
    "../../lib/billing-guidance": { billingGuide: () => [], billingStateLabel: value => value }
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(name => {
    assert.ok(name in dependencies, name); return dependencies[name];
  }, module, module.exports);
  function render() { cursor = 0; return module.exports.default(); }
  function nodes(node) {
    if (Array.isArray(node)) return node.flatMap(nodes);
    if (!node || typeof node !== "object") return [];
    return [node, ...nodes(node.props?.children)];
  }
  function portalButton() { return nodes(render()).find(node => node.type === "button" && node.props.className === "primary-link"); }
  function selector() { return nodes(render()).find(node => node.type === "select"); }
  return { calls, state, render, portalButton, selector };
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

test("same-tick and pending clicks open only one portal for the captured site", async () => {
  const request = deferred();
  const f = fixture(() => request.promise);
  const staleClick = f.portalButton().props.onClick;
  staleClick(); staleClick();
  assert.deepEqual(f.calls, ["site-a"]);
  assert.equal(f.portalButton().props.disabled, true);
  request.resolve(); await flush();
  staleClick();
  assert.deepEqual(f.calls, ["site-a"]);
  assert.equal(f.portalButton().props.disabled, true, "keep navigation guard until leaving the page");
});

test("website selection is frozen until a failed portal attempt settles", async () => {
  const request = deferred();
  const f = fixture(() => request.promise);
  const staleSelect = f.selector().props.onChange;
  f.portalButton().props.onClick();
  assert.equal(f.selector().props.disabled, true);
  staleSelect({ target: { value: "site-b" } });
  assert.equal(f.state[3], "site-a");
  assert.deepEqual(f.calls, ["site-a"]);
  request.reject(new Error("private-provider-marker")); await flush();
  assert.equal(f.selector().props.disabled, false);
  f.selector().props.onChange({ target: { value: "site-b" } });
  assert.equal(f.state[3], "site-b");
  assert.equal(f.state[0], null);
  assert.equal(f.state[5], true);
});

for (const locale of ["fr", "en"]) {
  test(`${locale}: rejected portal attempts release the form without exposing private details or automatic retries`, async () => {
    let attempts = 0;
    const f = fixture(async () => { if (++attempts === 1) throw new Error("private-provider-marker"); }, { locale });
    f.portalButton().props.onClick(); await flush();
    assert.deepEqual(f.calls, ["site-a"]);
    assert.equal(f.portalButton().props.disabled, false);
    assert.equal(JSON.stringify(f.render()).includes("private-provider-marker"), false);
    assert.match(f.state[1], locale === "fr" ? /Portail Stripe indisponible/ : /Stripe portal unavailable/);
    f.portalButton().props.onClick(); await flush();
    assert.deepEqual(f.calls, ["site-a", "site-a"]);
    assert.equal(f.portalButton().props.disabled, true);
  });
}

test("loading billing cannot open a portal", async () => {
  const f = fixture(async () => {}, { loading: true });
  assert.equal(f.portalButton().props.disabled, true);
  f.portalButton().props.onClick(); await flush();
  assert.deepEqual(f.calls, []);
});

test("a missing billing account has no portal action", () => {
  const f = fixture(async () => {}, { billingAccount: false });
  assert.equal(f.portalButton(), undefined);
  assert.deepEqual(f.calls, []);
});
