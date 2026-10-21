import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const code = ts.transpileModule(fs.readFileSync(new URL("../app/plans/page.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function fixture(open, { locale = "fr", subscribed = false, readBilling = async () => ({ hasStripeSubscription: false }) } = {}) {
  const sites = [{ id: "site-a", slug: "a" }, { id: "site-b", slug: "b" }];
  const entitlements = { planKey: "essential", storageMb: 100, aiMonthlyLimit: 10 };
  const state = [entitlements, { launchOperationsRemaining: 0 }, { active: false }, "essential", false,
    true, false, { today: 0, month: 0 }, { usedBytes: 0, limitMb: 100 }, sites, "site-a", "", "",
    { hasStripeSubscription: subscribed }];
  const refs = [{ current: 0 }, { current: false }, { current: "site-a" }];
  let cursor = 0, refCursor = 0;
  const calls = [];
  const element = (type, props) => ({ type, props });
  const dependencies = {
    react: {
      useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial;
        return [state[i], value => { state[i] = value; }]; },
      useRef(initial) { const i = refCursor++; return refs[i] ??= { current: initial }; },
      useEffect() {}
    },
    "react/jsx-runtime": { jsx: element, jsxs: element },
    "next/link": { default: "a" },
    "../../components/AccountShell": { AccountShell: "account-shell" },
    "../../components/BetaExperienceSwitch": { BetaExperienceSwitch: "beta-switch" },
    "../../lib/billing-access": {
      startPlanCheckout: (...args) => { calls.push(["checkout", ...args]); return open("checkout"); },
      startAiLaunchCheckout: (...args) => { calls.push(["launch", ...args]); return open("launch"); },
      openStripeBillingPortal: (...args) => { calls.push(["portal", ...args]); return open("portal"); },
      getMyBillingState: readBilling
    },
    "../../lib/subscription": { freeEntitlements: entitlements, getMySiteEntitlements: async () => entitlements,
      getMySiteAiAccess: async () => ({ launchOperationsRemaining: 0 }), getMyAiUsage: async () => ({ today: 0, month: 0 }),
      getMyStorageUsage: async () => ({ usedBytes: 0, limitMb: 100 }), getMyBetaAccess: async () => ({ active: false }) },
    "../../lib/supabase-site-repository": { getMySites: async () => sites },
    "../../lib/product-i18n": { useProductLocale: () => ({ locale, tr: (fr, en) => locale === "en" ? en : fr }) },
    "../../lib/product-format": { formatProductNumber: value => String(value) },
    "../../lib/product-plan-label": { productPlanLabel: value => value },
    "../../lib/beta-experience-mode": { readBetaExperienceMode: () => "essential", writeBetaExperienceMode() {} },
    "../../lib/product-analytics": { trackProductEvent() { throw new Error("unexpected analytics"); } }
  };
  const module = { exports: {} };
  const fakeWindow = { setTimeout: () => 1, clearTimeout() {} };
  new Function("require", "module", "exports", "window", code)(name => {
    assert.ok(name in dependencies, name); return dependencies[name];
  }, module, module.exports, fakeWindow);
  function render() { cursor = 0; refCursor = 0; return module.exports.default(); }
  function nodes(node) {
    if (Array.isArray(node)) return node.flatMap(nodes);
    if (!node || typeof node !== "object") return [];
    return [node, ...nodes(node.props?.children)];
  }
  const find = predicate => nodes(render()).find(predicate);
  return { calls, state, refs, render,
    plan: () => find(n => n.type === "button" && n.props.className === "button primary"),
    launch: () => find(n => n.type === "button" && n.props.className.includes("account-metric-action")),
    select: () => find(n => n.type === "select") };
}

for (const first of ["plan", "launch"]) {
  test(`${first} takes a shared immediate lock across both payment actions`, async () => {
    const pending = deferred(); const f = fixture(() => pending.promise);
    const plan = f.plan().props.onClick, launch = f.launch().props.onClick;
    (first === "plan" ? plan : launch)(); plan(); launch();
    assert.equal(f.calls.length, 1);
    assert.equal(f.select().props.disabled, true);
    assert.equal(f.plan().props.disabled, true);
    assert.equal(f.launch().props.disabled, true);
    pending.resolve(); await flush(); plan(); launch();
    assert.equal(f.calls.length, 1, "navigation success retains the shared guard");
  });
}

test("an existing subscription opens only the portal while all purchase actions are locked", async () => {
  const pending = deferred(); const f = fixture(() => pending.promise, { subscribed: true });
  const plan = f.plan().props.onClick, launch = f.launch().props.onClick;
  plan(); launch();
  assert.deepEqual(f.calls, [["portal", "site-a"]]);
  pending.resolve(); await flush();
});

for (const locale of ["fr", "en"]) for (const action of ["plan", "launch"]) {
  test(`${locale} ${action}: a rejected opening releases controls without leaking details or automatic retries`, async () => {
    let attempts = 0;
    const f = fixture(async () => { if (++attempts === 1) throw new Error("private-provider-marker"); }, { locale });
    f[action]().props.onClick(); await flush();
    assert.equal(f.calls.length, 1);
    assert.equal(JSON.stringify(f.render()).includes("private-provider-marker"), false);
    assert.equal(f.select().props.disabled, false);
    assert.equal(f.plan().props.disabled, false);
    assert.match(f.state[12], locale === "fr" ? /confirmé|confirmée/ : /confirmed/);
    f[action]().props.onClick(); await flush();
    assert.equal(f.calls.length, 2);
  });
}

test("a stale website selector cannot change the account during an opening", async () => {
  const pending = deferred(); const f = fixture(() => pending.promise);
  const select = f.select().props.onChange;
  f.plan().props.onClick(); select({ target: { value: "site-b" } });
  assert.equal(f.state[10], "site-a");
  assert.deepEqual(f.calls, [["checkout", "site-a", "growth", "monthly"]]);
  pending.resolve(); await flush();
});

test("changing website immediately invalidates stale payment handlers, including after the new read completes", async () => {
  const pending = deferred(); const f = fixture(async () => {}, { readBilling: () => pending.promise });
  const stalePlan = f.plan().props.onClick, staleLaunch = f.launch().props.onClick;
  f.select().props.onChange({ target: { value: "site-b" } });
  stalePlan(); staleLaunch();
  assert.deepEqual(f.calls, []);
  pending.resolve({ hasStripeSubscription: false }); await flush();
  stalePlan(); staleLaunch();
  assert.deepEqual(f.calls, []);
  f.plan().props.onClick(); await flush();
  assert.deepEqual(f.calls, [["checkout", "site-b", "growth", "monthly"]]);
});

test("failed billing verification cannot re-enable a stale payment handler", async () => {
  const f = fixture(async () => {}, { readBilling: async () => { throw new Error("private-read-marker"); } });
  const stale = f.plan().props.onClick;
  f.select().props.onChange({ target: { value: "site-b" } }); await flush(); stale();
  assert.deepEqual(f.calls, []);
  assert.equal(f.state[6], true);
});
