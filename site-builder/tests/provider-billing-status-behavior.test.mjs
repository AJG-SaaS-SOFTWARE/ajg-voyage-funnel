import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const code = ts.transpileModule(fs.readFileSync(new URL("../app/api/cron/stripe-provider-lifecycle-harness/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

const fixture = { ownerId: "a".repeat(32), siteId: "b".repeat(32), attemptId: "c".repeat(32) };
function load({ count = 0, adminMetadata = true } = {}) {
  let deletes = 0;
  const metadata = { purpose: "eltara_provider_billing_e2e", attempt_id: fixture.attemptId };
  const subscription = { plan_key: "growth", status: "active", provider: "stripe", provider_customer_id: "cus_synthetic", provider_subscription_id: "sub_synthetic", provider_price_id: "price_synthetic", first_payment_confirmed_at: "2026-10-14T12:00:00Z" };
  const service = {
    auth: { admin: { getUserById: async () => ({ data: { user: { app_metadata: adminMetadata ? metadata : {}, user_metadata: metadata } }, error: null }), deleteUser: async () => { deletes++; return { error: null }; } } },
    from(table) { return {
      select() { return this; }, eq() { return this; },
      async maybeSingle() { return { data: table === "sites" ? { id: fixture.siteId, owner_id: fixture.ownerId, brand_name: "ELTARA Provider Billing E2E" } : table === "site_subscriptions" ? subscription : { state: "active" }, error: null }; },
      then(resolve, reject) { return Promise.resolve({ count, error: null }).then(resolve, reject); }
    }; }
  };
  const module = { exports: {} };
  const deps = {
    "next/server": { NextResponse: { json: (body, options) => Response.json(body, options) } },
    "@supabase/supabase-js": { createClient: () => service },
    "../../../../lib/release-e2e-auth": { releaseE2EAuthorized: () => true },
    "../../../../lib/stripe-billing": { stripeCredentialMode: () => "test" }
  };
  new Function("require", "module", "exports", "process", "console", code)(name => { assert.ok(name in deps); return deps[name]; }, module, module.exports,
    { env: { NEXT_PUBLIC_SUPABASE_URL: "https://synthetic.test", SUPABASE_SECRET_KEY: "synthetic" } }, { error() {} });
  return { post: module.exports.POST, deletes: () => deletes };
}
const request = action => new Request("https://synthetic.test", { method: "POST", body: JSON.stringify({ ...fixture, action }) });

test("provider status exposes exact fixture attribution and rejects missing entitlement counts", async () => {
  for (const count of [0, null, -1, 0.5, "0"]) {
    const api = load({ count });
    const response = await api.post(request("status"));
    assert.equal(response.status, count === 0 ? 200 : 503);
    if (count === 0) {
      const body = await response.json();
      assert.equal(body.subscription.providerCustomerId, "cus_synthetic");
      assert.equal(body.subscription.providerSubscriptionId, "sub_synthetic");
      assert.equal(body.subscription.providerPriceId, "price_synthetic");
      assert.equal(body.activeAiLaunchEntitlements, 0);
    }
  }
});

test("user-editable fixture markers cannot authorize status or account cleanup", async () => {
  const api = load({ adminMetadata: false });
  for (const action of ["status", "cleanup"]) assert.equal((await api.post(request(action))).status, 404);
  assert.equal(api.deletes(), 0);
});
