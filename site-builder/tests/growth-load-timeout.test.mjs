import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../app/growth/page.tsx", import.meta.url), "utf8");
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
  const sites = [{ id: "site-a", slug: "a", status: "published", publishedAt: "2026-10-20T00:00:00Z" }];
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
    "next/navigation": { useRouter: () => ({ push() {} }) },
    "../../components/LanguageSwitch": { LanguageSwitch: "language-switch" },
    "../../components/BetaExperienceSwitch": { BetaExperienceSwitch: "beta-switch" },
    "../../lib/product-i18n": { useProductLocale: () => ({ locale: "en", tr: (_fr, en) => en }) },
    "../../lib/product-format": { formatProductNumber: String },
    "../../lib/supabase-browser": {
      getSupabaseBrowserClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: "token" } } }) } })
    },
    "../../lib/supabase-site-repository": { getMySites: readSites },
    "../../lib/site-analytics": {
      evaluatePostPublishPerformance: () => ({ outcome: "waiting" }),
      getMySiteAnalytics: async () => [],
      summarizeSiteAnalytics: () => ({ opportunities: [] })
    },
    "../../lib/subscription": {
      getMyBetaAccess: async () => ({ active: false, startsAt: null, expiresAt: null }),
      getMySiteEntitlements: async () => ({ planKey: "growth", status: "active" })
    },
    "../../lib/beta-experience-mode": { readBetaExperienceMode: () => "growth", writeBetaExperienceMode() {} },
    "../../lib/product-analytics": { trackProductEvent() {} },
    "../../lib/support-guidance": { supportGuidanceForCheck: () => null },
    "../../lib/growth-health": { groupGrowthHealthChecks: () => [], growthHealthCounts: () => ({ healthy: 0, action: 0, incident: 0 }) },
    "../../lib/growth-actions": {
      getMyGrowthActions: async () => [],
      measureGrowthAction: () => ({ state: "waiting" }),
      startGrowthAction: async () => ({})
    }
  };
  const fakeWindow = {
    setTimeout(callback, delay) {
      const id = ++nextTimerId;
      timers.push({ id, callback, delay });
      return id;
    },
    clearTimeout(id) { cleared.push(id); }
  };
  const fakeFetch = async () => ({ ok: true, status: 200, json: async () => ({ health: { diagnosis: { checks: [] } } }) });
  const module = { exports: {} };
  new Function("require", "module", "exports", "window", "fetch", code)(name => {
    assert.ok(name in dependencies, name);
    return dependencies[name];
  }, module, module.exports, fakeWindow, fakeFetch);
  function render() {
    cursor = 0;
    refCursor = 0;
    effects.length = 0;
    return module.exports.default();
  }
  return { effects, state, refs, timers, cleared, sites, render };
}

test("a hung Growth read becomes recoverable and ignores the late snapshot", async () => {
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
  assert.equal(page.state[0], "error");
  assert.equal(page.state[7], false, "stop the loading state after the deadline");
  assert.match(page.state[6], /load could not be confirmed/);

  late.resolve(page.sites);
  await flush();
  assert.equal(page.state[0], "error");
  assert.deepEqual(page.state[1], [], "a late site list cannot replace the failed snapshot");
  assert.deepEqual(page.cleared, [page.timers[0].id]);
});

