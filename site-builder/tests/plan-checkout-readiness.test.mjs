import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source = fs.readFileSync(new URL("../app/plans/page.tsx", import.meta.url), "utf8");

function functions(overrides = {}) {
  const state = { loaded: true, loadFailed: false, siteId: "site", betaAccess: { active: false }, checkoutBusy: "", billingState: null, calls: [] };
  const dependencies = {
    ...state, tr: (fr) => fr,
    setCheckoutBusy: value => state.calls.push(["busy", value]),
    setCheckoutMessage: value => state.calls.push(["message", value]),
    startPlanCheckout: async (...args) => state.calls.push(["checkout", ...args]),
    openStripeBillingPortal: async (...args) => state.calls.push(["portal", ...args]),
    startAiLaunchCheckout: async (...args) => state.calls.push(["launch", ...args]),
    ...overrides,
  };
  const start = source.indexOf("  async function beginPlanChange(");
  const end = source.indexOf("  const betaExpiryLabel", start);
  const code = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const api = new Function(...Object.keys(dependencies), code + "; return {beginPlanChange, buyAiLaunch};")(...Object.values(dependencies));
  return { ...api, calls: state.calls };
}

for (const [label, state] of [
  ["loading", { loaded: false }], ["failed account read", { loadFailed: true }],
  ["missing site", { siteId: "" }], ["beta access", { betaAccess: { active: true } }],
  ["checkout already opening", { checkoutBusy: "growth:annual" }],
]) {
  test("does not open a payment flow for " + label, async () => {
    const api = functions(state);
    await api.beginPlanChange("growth", "annual");
    await api.buyAiLaunch();
    assert.deepEqual(api.calls, []);
  });
}
test("verified new subscription retains the chosen plan and annual cycle", async () => {
  const api = functions();
  await api.beginPlanChange("growth", "annual");
  assert.ok(api.calls.some(call => JSON.stringify(call) === JSON.stringify(["checkout", "site", "growth", "annual"])));
});
test("existing subscription opens the billing portal without another Checkout", async () => {
  const api = functions({ billingState: { hasStripeSubscription: true } });
  await api.beginPlanChange("essential", "monthly");
  assert.ok(api.calls.some(call => call[0] === "portal"));
  assert.ok(!api.calls.some(call => call[0] === "checkout"));
});

async function loadAccount(billing, concurrent = false) {
  const state = { loaded: true, failed: false, billing: { hasStripeSubscription: true } };
  const deps = {
    loadSequence: { current: 0 }, siteId: "site", getMySites: async () => [{ id: "site", slug: "fixture" }],
    setSites() {}, setSiteId() {}, setCurrent() {}, setAiAccess() {}, setUsage() {}, setStorage() {}, setBetaAccess() {}, setBetaExperienceMode() {},
    setLoaded: value => { state.loaded = value; },
    setLoadFailed: value => { state.failed = value; },
    setBillingState: value => { state.billing = value; },
    getMySiteEntitlements: async () => ({}), getMySiteAiAccess: async () => ({}),
    getMyAiUsage: async () => ({}), getMyStorageUsage: async () => ({}),
    getMyBetaAccess: async () => ({ active: false }), getMyBillingState: billing,
  };
  const start = source.indexOf("  const load = async");
  const end = source.indexOf("  useEffect(", start);
  const code = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const load = new Function(...Object.keys(deps), code + ";return load;")(...Object.values(deps));
  if (concurrent) {
    const first = load();
    await Promise.resolve();
    const second = load();
    await second;
    await first;
  } else await load();
  return state;
}
test("billing read errors block payment without retaining the previous site's billing", async () => {
  const state = await loadAccount(async () => { throw new Error("unavailable"); });
  assert.equal(state.loaded, true);
  assert.equal(state.failed, true);
  assert.equal(state.billing, null);
});
test("an absent billing result is not treated as a verified new subscription", async () => {
  assert.equal((await loadAccount(async () => null)).failed, true);
});
test("a verified account completes loading with its current billing state", async () => {
  const billing = { hasStripeSubscription: false };
  const state = await loadAccount(async () => billing);
  assert.equal(state.failed, false);
  assert.equal(state.loaded, true);
  assert.equal(state.billing, billing);
});

for (const staleFails of [false, true]) {
  test("stale billing " + (staleFails ? "error" : "response") + " cannot replace the latest account", async () => {
    let finish;
    let count = 0;
    const latest = { hasStripeSubscription: true };
    const state = await loadAccount(() => {
      if (++count === 1) return new Promise((resolve, reject) => { finish = () => staleFails ? reject(new Error("stale")) : resolve({ hasStripeSubscription: false }); });
      queueMicrotask(finish);
      return Promise.resolve(latest);
    }, true);
    assert.equal(state.billing, latest);
    assert.equal(state.failed, false);
  });
}
