import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const audit = fs.readFileSync(
  new URL("../lib/stripe-readiness.ts", import.meta.url),
  "utf8"
);
const readiness = fs.readFileSync(
  new URL("../app/api/admin/release-readiness/route.ts", import.meta.url),
  "utf8"
);

test("Stripe runtime readiness verifies every ELTARA commercial price", () => {
  for (const env of [
    "STRIPE_ESSENTIAL_MONTHLY_PRICE_ID",
    "STRIPE_ESSENTIAL_ANNUAL_PRICE_ID",
    "STRIPE_GROWTH_MONTHLY_PRICE_ID",
    "STRIPE_GROWTH_ANNUAL_PRICE_ID",
    "STRIPE_AI_LAUNCH_PRICE_ID"
  ]) {
    assert.ok(audit.includes(env));
  }

  assert.ok(audit.includes("amount: 1500"));
  assert.ok(audit.includes("amount: 15000"));
  assert.ok(audit.includes("amount: 2900"));
  assert.ok(audit.includes("amount: 29000"));
  assert.ok(audit.includes("amount: 4900"));
  assert.ok(audit.includes('currency === "eur"'));
  assert.ok(audit.includes('product?.metadata?.app === "ajg_site_builder"'));
});

test("Stripe runtime readiness validates the controlled Customer Portal", () => {
  assert.ok(audit.includes("STRIPE_PORTAL_CONFIGURATION_ID"));
  assert.ok(audit.includes('mode === "at_period_end"'));
  assert.ok(audit.includes("payment_method_update"));
  assert.ok(audit.includes("invoice_history"));
  assert.ok(audit.includes("subscription_update"));
});

test("release readiness promotes Stripe runtime mismatches to blockers", () => {
  assert.ok(readiness.includes("auditStripeRuntime"));
  assert.ok(readiness.includes('status: item.ok ? "pass" : "blocker"'));
  assert.ok(readiness.includes('key: "stripe-runtime-audit"'));
  assert.ok(readiness.includes('status: "deferred"'));
});


test("production release performs a fail-closed Stripe sandbox mutation smoke", () => {
  const billing = fs.readFileSync(
    new URL("../lib/stripe-billing.ts", import.meta.url),
    "utf8"
  );
  const route = fs.readFileSync(
    new URL("../app/api/cron/stripe-sandbox-smoke/route.ts", import.meta.url),
    "utf8"
  );
  const workflow = fs.readFileSync(
    new URL("../../.github/workflows/site-builder-production.yml", import.meta.url),
    "utf8"
  );

  assert.ok(billing.includes("runStripeSandboxCheckoutSmoke"));
  assert.ok(billing.includes('key.startsWith("rk_test_")'));
  assert.ok(billing.includes('key.startsWith("sk_test_")'));
  assert.ok(billing.includes("/checkout/sessions"));
  assert.ok(billing.includes("/expire"));
  assert.ok(billing.includes('status !== "expired"'));

  assert.ok(route.includes("releaseE2EAuthorized(request)"));
  assert.ok(route.includes("AJG_BILLING_CHECKOUT_ENABLED"));
  assert.ok(route.includes("Sandbox smoke is disabled while commercial Checkout is open."));
  assert.ok(route.includes("STRIPE_ESSENTIAL_MONTHLY_PRICE_ID"));
  assert.ok(route.includes("checkoutEnabled: false"));

  assert.ok(workflow.includes("Run Stripe sandbox mutation smoke"));
  assert.ok(workflow.includes("/api/cron/stripe-sandbox-smoke"));
  assert.ok(workflow.includes("payload?.mode !== \"test\""));
  assert.ok(workflow.includes("payload?.expired !== true"));
});

test("Stripe sandbox mutation smoke never exposes the credential or opens commercial Checkout", () => {
  const route = fs.readFileSync(
    new URL("../app/api/cron/stripe-sandbox-smoke/route.ts", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(route, /STRIPE_RESTRICTED_KEY/);
  assert.doesNotMatch(route, /STRIPE_SECRET_KEY/);
  assert.doesNotMatch(route, /AJG_COMMERCIAL_(?:LEGAL|TAX)_READY/);
  assert.doesNotMatch(route, /process\.env\.AJG_BILLING_CHECKOUT_ENABLED\s*=/);
});


test("production release validates the disposable billing lifecycle without opening Checkout", () => {
  const route = fs.readFileSync(
    new URL("../app/api/cron/billing-lifecycle-smoke/route.ts", import.meta.url),
    "utf8"
  );
  const workflow = fs.readFileSync(
    new URL("../../.github/workflows/site-builder-production.yml", import.meta.url),
    "utf8"
  );

  assert.ok(route.includes("releaseE2EAuthorized(request)"));
  assert.ok(route.includes("AJG_BILLING_CHECKOUT_ENABLED"));
  assert.ok(route.includes("apply_builder_site_billing_provider_event_v2"));
  assert.ok(route.includes('"subscription_active_before_payment"'));
  assert.ok(route.includes('"first_payment_succeeded"'));
  assert.ok(route.includes('"renewal_failed"'));
  assert.ok(route.includes('"payment_recovered"'));
  assert.ok(route.includes('"subscription_canceled"'));
  assert.ok(route.includes("prepayment_cost_gate_failed"));
  assert.ok(route.includes("payment_failure_grace_failed"));
  assert.ok(route.includes("payment_recovery_failed"));
  assert.ok(route.includes("cancellation_cost_gate_failed"));
  assert.ok(route.includes('provider", "stripe_e2e"'));
  assert.ok(route.includes("deleteUser(userId)"));

  assert.ok(workflow.includes("Run disposable billing lifecycle smoke"));
  assert.ok(workflow.includes("/api/cron/billing-lifecycle-smoke"));
  assert.ok(workflow.includes('payload?.mode !== "synthetic_provider_lifecycle"'));
  assert.ok(workflow.includes("payload?.checkoutEnabled !== false"));
  assert.ok(workflow.includes("payload?.cleanupOk !== true"));
});
