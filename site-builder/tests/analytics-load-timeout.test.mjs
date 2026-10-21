import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../app/analytics/page.tsx", import.meta.url), "utf8");
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
  const sites = [{ id: "site-a", slug: "a", status: "published", publishedAt: "2026-10-20T00:00:00Z", config: { brandName: "A" } }];
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
      useEffect(effect) { effects.push(effect); },
      useMemo(factory) { return factory(); }
    },
    "react/jsx-runtime": { Fragment: "fragment", jsx: element, jsxs: element },
    "next/link": { default: "a" },
    "../../components/AccountShell": { AccountShell: "account-shell" },
    "../../components/BetaExperienceSwitch": { BetaExperienceSwitch: "beta-switch" },
    "../../lib/product-i18n": { useProductLocale: () => ({ locale: "en", tr: (_fr, en) => en }) },
    "../../lib/product-format": { formatProductNumber: String },
    "../../lib/supabase-site-repository": { getMySites: readSites },
    "../../lib/subscription": {
      getMyBetaAccess: async () => ({ active: false, startsAt: null, expiresAt: null }),
      getMySiteEntitlements: async () => ({ planKey: "growth", status: "active" })
    },
    "../../lib/beta-experience-mode": { readBetaExperienceMode: () => "growth", writeBetaExperienceMode() {} },
    "../../lib/site-analytics": {
      compareSiteAnalytics: () => ({ current: { views: 0 }, deltas: {} }),
      getMySiteAnalytics: async () => []
    },
    "../../lib/product-analytics": { trackProductEvent() {} }
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

test("a hung Analytics read becomes recoverable and ignores the late snapshot", async () => {
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
  assert.equal(page.state[4], "error");
  assert.match(page.state[5], /load could not be confirmed/);

  late.resolve(page.sites);
  await flush();
  assert.equal(page.state[4], "error");
  assert.deepEqual(page.state[0], [], "a late site list cannot replace the failed snapshot");
  assert.deepEqual(page.state[2], [], "late analytics cannot replace the failed snapshot");
  assert.deepEqual(page.cleared, [page.timers[0].id]);
});
