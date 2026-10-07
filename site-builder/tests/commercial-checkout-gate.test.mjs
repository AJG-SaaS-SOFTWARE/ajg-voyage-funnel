import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const gate = fs.readFileSync(
  new URL("../lib/commercial-checkout-readiness.ts", import.meta.url),
  "utf8"
);
const checkout = fs.readFileSync(
  new URL("../app/api/billing/checkout/route.ts", import.meta.url),
  "utf8"
);
const admin = fs.readFileSync(
  new URL("../app/api/admin/release-readiness/route.ts", import.meta.url),
  "utf8"
);
const stripeReadiness = fs.readFileSync(
  new URL("../lib/stripe-readiness.ts", import.meta.url),
  "utf8"
);

test("commercial Checkout requires legal, tax and Stripe readiness in addition to the feature flag", () => {
  assert.ok(gate.includes("AJG_COMMERCIAL_LEGAL_READY"));
  assert.ok(gate.includes("AJG_COMMERCIAL_TAX_READY"));
  assert.ok(gate.includes("AJG_COMMERCIAL_MARKET"));
  assert.ok(gate.includes("AJG_VAT_REGIME"));
  assert.ok(gate.includes("AJG_STRIPE_TAX_CODE"));
  assert.ok(gate.includes("STRIPE_WEBHOOK_SECRET"));
  assert.ok(gate.includes("STRIPE_PORTAL_CONFIGURATION_ID"));
  assert.ok(gate.includes("auditStripeRuntimeCached"));
});

test("Checkout fails closed without exposing internal readiness reasons to the customer", () => {
  const flagPos = checkout.indexOf("if (!checkoutEnabled())");
  const readinessPos = checkout.indexOf("commercialCheckoutReadiness()");
  const bodyPos = checkout.indexOf("const body = await request.json()");

  assert.ok(flagPos >= 0);
  assert.ok(readinessPos > flagPos);
  assert.ok(bodyPos > readinessPos);
  assert.ok(checkout.includes('code: "commercial_readiness_blocked"'));
  assert.ok(checkout.includes("reasonCount: commercialReadiness.reasons.length"));
  assert.ok(!checkout.includes("reasons: commercialReadiness.reasons"));
});

test("admin readiness and Checkout share the same local commercial configuration rules", () => {
  assert.ok(admin.includes("commercialConfigurationReadiness"));
  assert.ok(admin.includes("commercialConfig.legal.ok"));
  assert.ok(admin.includes("commercialConfig.tax.ok"));
  assert.ok(admin.includes("commercialConfig.stripe.ok"));
});

test("Stripe remote readiness is parallelized and cached before Checkout", () => {
  assert.ok(stripeReadiness.includes("Promise.all(EXPECTED_PRICES.map(auditExpectedPrice))"));
  assert.ok(stripeReadiness.includes("auditStripeRuntimeCached"));
  assert.ok(stripeReadiness.includes("expiresAt"));
  assert.ok(stripeReadiness.includes("300_000"));
});
