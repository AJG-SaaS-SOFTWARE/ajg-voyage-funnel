import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const code = ts.transpileModule(fs.readFileSync(new URL("../lib/billing-access.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

function client(fetcher, locale = "fr") {
  const controller = new AbortController(), deadlines = [], calls = [], navigations = [];
  const loaded = { exports: {} };
  const dependencies = {
    "./supabase-browser": { getSupabaseBrowserClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: "synthetic" } }, error: null }) } }) },
    "./supabase-site-repository": {}, "./site-recovery": {},
    "./product-i18n": { getProductLocale: () => locale }
  };
  new Function("require", "module", "exports", "fetch", "window", "AbortSignal", code)(
    name => { assert.ok(name in dependencies); return dependencies[name]; }, loaded, loaded.exports,
    async (path, options) => { calls.push({ path, options }); return fetcher(options, controller); },
    { location: { assign: url => navigations.push(url) } },
    { timeout: ms => { deadlines.push(ms); return controller.signal; } }
  );
  return { ...loaded.exports, controller, deadlines, calls, navigations };
}

const openings = [
  ["plan", api => api.startPlanCheckout("site-synthetic", "essential", "annual"), "/api/billing/checkout", { planKey: "essential", billingCycle: "annual" }],
  ["growth", api => api.startGrowthCheckout("site-synthetic"), "/api/billing/checkout", { planKey: "growth", billingCycle: "monthly" }],
  ["AI Creation", api => api.startAiLaunchCheckout("site-synthetic"), "/api/billing/checkout", { purchaseType: "ai_launch" }],
  ["portal", api => api.openStripeBillingPortal("site-synthetic"), "/api/billing/portal", {}]
];
const timeoutMessage = locale => locale === "en"
  ? "The billing page opening could not be confirmed. No payment change is confirmed here. You can try again manually."
  : "L’ouverture de la facturation n’a pas pu être confirmée. Aucun changement de paiement n’est confirmé ici. Vous pouvez réessayer manuellement.";

for (const locale of ["fr", "en"]) {
  for (const [name, open, path, payload] of openings) {
    test(`${locale}: ${name} bounds the request without changing its authenticated contract`, async () => {
      const url = name === "portal" ? "https://billing.stripe.com/p/session/synthetic" : "https://checkout.stripe.com/c/pay/synthetic";
      const api = client(async () => ({ ok: true, json: async () => ({ url }) }), locale);
      await open(api);
      assert.deepEqual(api.deadlines, [60000]);
      assert.equal(api.calls.length, 1);
      const call = api.calls[0];
      assert.equal(call.path, path);
      assert.equal(call.options.method, "POST");
      assert.equal(call.options.signal, api.controller.signal);
      assert.deepEqual(call.options.headers, { "Content-Type": "application/json", Authorization: "Bearer synthetic", "X-AJG-Locale": locale });
      assert.deepEqual(JSON.parse(call.options.body), { siteId: "site-synthetic", locale, ...payload });
      assert.deepEqual(api.navigations, [url]);
    });
  }

  for (const stage of ["fetch", "body", "late body"]) {
    test(`${locale}: expiry during ${stage} neither navigates nor retries any billing mutation`, async () => {
      for (const [, open] of openings) {
        const api = client(async (options, controller) => {
          if (stage === "fetch") {
            controller.abort();
            throw new Error("private transport marker");
          }
          return { ok: true, json: async () => {
            controller.abort();
            if (stage === "body") throw new Error("private body marker");
            return { url: "https://checkout.stripe.com/c/pay/late-synthetic" };
          } };
        }, locale);
        await assert.rejects(open(api), { message: timeoutMessage(locale) });
        assert.equal(api.calls.length, 1);
        assert.deepEqual(api.navigations, []);
      }
    });
  }
}

test("a genuinely pending fetch observes abort and settles without a second POST", async () => {
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const api = client(options => new Promise((resolve, reject) => {
    assert.ok(options.signal, "billing fetch must carry the deadline signal");
    options.signal.addEventListener("abort", () => reject(new Error("private abort marker")), { once: true });
    entered();
  }), "en");
  const opening = api.openStripeBillingPortal("site-synthetic");
  const rejection = assert.rejects(opening, { message: timeoutMessage("en") });
  // The signal assertion also rejects safely against the old implementation.
  await Promise.race([started, rejection]);
  api.controller.abort();
  await rejection;
  assert.equal(api.calls.length, 1);
  assert.deepEqual(api.navigations, []);
});

test("non-timeout failures preserve existing behavior with no navigation or automatic retry", async () => {
  const failure = new Error("network unavailable");
  const network = client(async () => { throw failure; });
  await assert.rejects(network.openStripeBillingPortal("site-synthetic"), error => error === failure);
  for (const response of [
    { ok: false, json: async () => ({ error: "safe server refusal" }) },
    { ok: true, json: async () => { throw new Error("invalid JSON"); } },
    { ok: true, json: async () => ({}) }
  ]) {
    const api = client(async () => response);
    await assert.rejects(api.startGrowthCheckout("site-synthetic"));
    assert.equal(api.calls.length, 1);
    assert.deepEqual(api.navigations, []);
  }
  assert.equal(network.calls.length, 1);
  assert.deepEqual(network.navigations, []);
});
