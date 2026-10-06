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
