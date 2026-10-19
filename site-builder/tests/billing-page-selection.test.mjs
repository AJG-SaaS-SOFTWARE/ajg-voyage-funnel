import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";

const sites = [{ id: "site-a", slug: "a" }, { id: "site-b", slug: "b" }];
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
function harness(getBilling, search = "?siteId=site-b", getSites = async () => sites) {
  const state = [];
  let cursor, effect, cleanup;
  const calls = [];
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = value; }];
    },
    useEffect(callback) { effect = callback; },
    useRef(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = { current: initial };
      return state[index];
    }
  };
  const code = ts.transpileModule(fs.readFileSync(new URL("../app/billing/page.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText;
  const loaded = { exports: {} };
  const dependencies = {
    react: hooks,
    "react/jsx-runtime": jsx,
    "../../components/AccountShell": { AccountShell: () => null },
    "../../lib/billing-access": { getMyBillingState: id => { calls.push(id); return getBilling(id); } },
    "../../lib/supabase-site-repository": { getMySites: getSites },
    "../../lib/product-i18n": { useProductLocale: () => ({ locale: "fr", tr: fr => fr }) },
    "../../lib/billing-guidance": { billingGuide: () => [], billingStateLabel: value => value }
  };
  new Function("require", "module", "exports", "window", code)(name => {
    assert.ok(name in dependencies, name);
    return dependencies[name];
  }, loaded, loaded.exports, { location: { search } });
  return {
    state, calls,
    render() { cleanup?.(); cursor = 0; loaded.exports.default(); cleanup = effect(); },
    select(id) { state[3] = id; this.render(); },
    unmount() { cleanup?.(); }
  };
}

test("billing follows the owned website requested by the Stripe return URL", async () => {
  const page = harness(async id => ({ state: "active", site: id }));
  page.render();
  await flush();
  assert.equal(page.state[3], "site-b");
  page.render();
  await flush();
  assert.deepEqual(page.calls, ["site-b"]);
  assert.equal(page.state[0].site, "site-b");
  assert.equal(page.state[5], false);
});

test("a slow response for the previous site cannot replace the selected site's billing", async () => {
  const old = deferred();
  const page = harness(id => id === "site-a" ? old.promise : Promise.resolve({ state: "active", site: id }), "?siteId=site-a");
  page.render(); await flush(); page.render(); await flush();
  page.select("site-b");
  assert.equal(page.state[0], null);
  assert.equal(page.state[5], true);
  await flush();
  old.resolve({ state: "restricted", site: "site-a" });
  await flush();
  assert.equal(page.state[0].site, "site-b");
  assert.equal(page.state[5], false);
});

test("current read failures show a recoverable error, while obsolete failures are ignored", async () => {
  const old = deferred();
  const page = harness(id => id === "site-a" ? old.promise : Promise.reject(new Error("private marker")), "?siteId=site-a");
  page.render(); await flush(); page.render(); await flush();
  page.select("site-b"); await flush();
  assert.equal(page.state[1], "Impossible de charger l’état de facturation.");
  assert.equal(page.state[5], false);
  old.reject(new Error("obsolete")); await flush();
  assert.equal(page.state[1], "Impossible de charger l’état de facturation.");
  assert.equal(page.state[0], null);
});

test("unowned URL targets never trigger a billing read and empty accounts finish loading", async () => {
  const page = harness(async id => ({ state: "active", site: id }), "?siteId=not-owned");
  page.render(); await flush(); page.render(); await flush();
  assert.deepEqual(page.calls, ["site-a"]);
  const empty = harness(async () => { throw new Error("unexpected"); }, "", async () => []);
  empty.render(); await flush();
  assert.equal(empty.state[5], false);
  assert.deepEqual(empty.calls, []);
});
