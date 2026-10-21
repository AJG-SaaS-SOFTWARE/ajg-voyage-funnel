import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../app/plans/page.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText;

const deferred = () => {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
};
const flush = async () => { for (let i = 0; i < 16; i += 1) await Promise.resolve(); };

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
  const entitlements = { planKey: "free", storageMb: 100, aiMonthlyLimit: 10 };
  const dependencies = {
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in state)) state[index] = initial;
        return [state[index], value => { state[index] = value; }];
      },
      useRef(initial) {
        const index = refCursor++;
        if (!(index in refs)) refs[index] = { current: initial };
        return refs[index];
      },
      useEffect(effect) { effects.push(effect); }
    },
    "react/jsx-runtime": { jsx: element, jsxs: element },
    "next/link": { default: "a" },
    "../../components/AccountShell": { AccountShell: "account-shell" },
    "../../components/BetaExperienceSwitch": { BetaExperienceSwitch: "beta-switch" },
    "../../lib/billing-access": {
      getMyBillingState: async () => ({ hasStripeSubscription: false }),
      openStripeBillingPortal() { throw new Error("unexpected portal"); },
      startAiLaunchCheckout() { throw new Error("unexpected checkout"); },
      startPlanCheckout() { throw new Error("unexpected checkout"); }
    },
    "../../lib/subscription": {
      freeEntitlements: entitlements,
      getMySiteEntitlements: async () => entitlements,
      getMySiteAiAccess: async () => ({ launchOperationsRemaining: 0 }),
      getMyAiUsage: async () => ({ today: 0, month: 0 }),
      getMyStorageUsage: async () => ({ usedBytes: 0, limitMb: 100 }),
      getMyBetaAccess: async () => ({ active: false, startsAt: null, expiresAt: null })
    },
    "../../lib/supabase-site-repository": { getMySites: readSites },
    "../../lib/product-i18n": { useProductLocale: () => ({ locale: "fr", tr: fr => fr }) },
    "../../lib/product-format": { formatProductNumber: String },
    "../../lib/product-plan-label": { productPlanLabel: String },
    "../../lib/beta-experience-mode": { readBetaExperienceMode: () => "essential", writeBetaExperienceMode() {} },
    "../../lib/product-analytics": { trackProductEvent() { throw new Error("unexpected analytics"); } }
  };
  const fakeWindow = {
    setTimeout(callback, delay) {
      const id = ++nextTimerId;
      timers.push({ id, callback, delay });
      return id;
    },
    clearTimeout(id) { cleared.push(id); }
  };
  const fakeFetch = async () => ({ ok: true, json: async () => ({ annualIncludesLaunch: false }) });
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

test("a hung account read reaches a recoverable state and ignores a late response", async () => {
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
  assert.equal(page.state[5], true, "finish loading after the deadline");
  assert.equal(page.state[6], true, "show the recoverable account verification error");
  assert.equal(page.refs[2].current, "", "keep Checkout disabled");

  late.resolve(page.sites);
  await flush();
  assert.equal(page.state[5], true);
  assert.equal(page.state[6], true);
  assert.equal(page.state[9].length, 0, "late sites cannot replace the failed snapshot");
  assert.deepEqual(page.cleared, [page.timers[0].id]);
});
