import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../app/data/page.tsx", import.meta.url), "utf8");
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
  const sites = [{ id: "site-a", slug: "a", config: { brandName: "A" } }];
  const erasureRequests = [{
    id: "request-a",
    scope: "site",
    siteId: "site-a",
    status: "requested",
    requestedAt: "2026-10-22T00:00:00Z"
  }];
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
      useCallback(callback) { return callback; },
      useEffect(effect) { effects.push(effect); },
      useMemo(factory) { return factory(); }
    },
    "react/jsx-runtime": { Fragment: "fragment", jsx: element, jsxs: element },
    "../../components/AccountShell": { AccountShell: "account-shell" },
    "../../components/CustomerErrorHelp": { CustomerErrorHelp: "customer-error-help" },
    "../../lib/product-i18n": { useProductLocale: () => ({ locale: "en", tr: (_fr, en) => en }) },
    "../../lib/billing-access": {
      downloadMySiteExport() { throw new Error("unexpected export"); },
      downloadMySiteRecoveryJson() { throw new Error("unexpected recovery export"); }
    },
    "../../lib/site-recovery": { siteConfigFromRecoveryExport() { throw new Error("unexpected restore"); } },
    "../../lib/data-rights": {
      getMyErasureRequests: async () => erasureRequests,
      requestDataErasure() { throw new Error("unexpected erasure"); }
    },
    "../../lib/supabase-site-repository": {
      getCurrentUser: async () => ({ email: "customer@example.invalid" }),
      getMySites: readSites,
      saveMySite() { throw new Error("unexpected save"); }
    }
  };
  const fakeWindow = {
    setTimeout(callback, delay) {
      const id = ++nextTimerId;
      timers.push({ id, callback, delay });
      return id;
    },
    clearTimeout(id) { cleared.push(id); },
    confirm() { return false; }
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
  return { effects, state, refs, timers, cleared, sites, erasureRequests, render };
}

test("a hung data-area read becomes recoverable without exposing a partial snapshot", async () => {
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
  assert.equal(page.state[9], true, "offer a safe read retry after the deadline");
  assert.equal(page.state[8], true, "show customer recovery guidance");
  assert.match(page.state[6], /load could not be confirmed/);
  assert.equal(page.state[2], "", "do not expose an email from a partial snapshot");
  assert.deepEqual(page.state[0], []);
  assert.deepEqual(page.state[1], []);

  late.resolve(page.sites);
  await flush();
  assert.equal(page.state[9], true);
  assert.equal(page.state[2], "");
  assert.deepEqual(page.state[0], [], "late sites cannot replace the failed snapshot");
  assert.deepEqual(page.state[1], [], "late erasure requests cannot replace the failed snapshot");
  assert.deepEqual(page.cleared, [page.timers[0].id]);
});
