import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../app/domains/page.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText;

const deferred = () => {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
};
const flush = async () => { for (let index = 0; index < 20; index += 1) await Promise.resolve(); };

function fixture(readSites) {
  const state = [];
  const refs = [];
  const effects = [];
  const timers = [];
  const cleared = [];
  let cursor = 0;
  let refCursor = 0;
  let nextTimerId = 0;
  const element = (type, props) => ({ type, props });
  const sites = [{ id: "site-a", slug: "a" }];
  const dependencies = {
    react: {
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
      useEffect(effect) { effects.push(effect); }
    },
    "react/jsx-runtime": { Fragment: "fragment", jsx: element, jsxs: element },
    "../../components/AccountShell": { AccountShell: "account-shell" },
    "../../components/CustomerErrorHelp": { CustomerErrorHelp: "customer-error-help" },
    "../../lib/product-i18n": { useProductLocale: () => ({ locale: "en", tr: (_fr, en) => en }) },
    "../../lib/supabase-site-repository": {
      getMySites: readSites,
      getMyDomains: async () => [{ id: "domain-a", hostname: "a.example.invalid", kind: "custom_domain", verificationStatus: "verified", isPrimary: true }],
      getMySite() { throw new Error("unexpected site mutation read"); },
      removeCustomDomain() { throw new Error("unexpected remove"); },
      requestCustomDomain() { throw new Error("unexpected request"); },
      syncSiteDomain() { throw new Error("unexpected sync"); }
    },
    "../../lib/subscription": {
      freeEntitlements: { planKey: "free", customDomain: false, status: "active" },
      getMySiteEntitlements: async () => ({ planKey: "essential", customDomain: true, status: "active" })
    },
    "../../lib/domain-guidance": { domainGuide: () => [] },
    "../../lib/domain-action-result": { runDomainAction() { throw new Error("unexpected action"); } }
  };
  const fakeWindow = {
    setTimeout(callback, delay) {
      const id = ++nextTimerId;
      timers.push({ id, callback, delay });
      return id;
    },
    clearTimeout(id) { cleared.push(id); }
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", "window", code)(name => {
    assert.ok(name in dependencies, name);
    return dependencies[name];
  }, module, module.exports, fakeWindow);
  function render() {
    cursor = 0;
    refCursor = 0;
    effects.length = 0;
    return module.exports.default();
  }
  return { effects, state, refs, timers, cleared, sites, render };
}

test("a hung domain snapshot becomes recoverable and ignores late reads", async () => {
  const late = deferred();
  const page = fixture(() => late.promise);
  page.render();
  assert.equal(page.effects.length, 1);
  page.effects[0]();
  await flush();
  assert.equal(page.timers.length, 1);
  assert.equal(page.timers[0].delay, 15_000);

  page.timers[0].callback();
  await flush();
  assert.equal(page.state[5], true, "offer a safe read retry after the deadline");
  assert.equal(page.state[6], true, "show customer recovery guidance");
  assert.equal(page.state[4], false, "release the busy state");
  assert.match(page.state[3], /load could not be confirmed/);
  assert.deepEqual(page.state[0], [], "do not expose partial domain data");
  assert.deepEqual(page.state[7], [], "do not expose a partial site list");

  late.resolve(page.sites);
  await flush();
  assert.equal(page.state[5], true);
  assert.deepEqual(page.state[0], [], "a late domain snapshot cannot replace the failed view");
  assert.deepEqual(page.state[7], [], "a late site list cannot replace the failed view");
  assert.deepEqual(page.cleared, [page.timers[0].id]);
});
