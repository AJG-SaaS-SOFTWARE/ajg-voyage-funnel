import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import {
  normalizeStripeSubscriptionStatus,
  stripePeriodEnd,
  stripeSubscriptionIdFromInvoice,
  verifyStripeWebhookSignature
} from "../lib/stripe-billing.ts";

test("Stripe webhook signatures are verified against raw payload and timestamp", () => {
  const payload = JSON.stringify({ id: "evt_test", type: "invoice.paid" });
  const secret = "whsec_test_secret";
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`, "utf8")
    .digest("hex");

  assert.equal(
    verifyStripeWebhookSignature(
      payload,
      `t=${timestamp},v1=${digest}`,
      secret,
      300
    ),
    true
  );
  assert.equal(
    verifyStripeWebhookSignature(
      payload + "tampered",
      `t=${timestamp},v1=${digest}`,
      secret,
      300
    ),
    false
  );
});

test("old Stripe webhook signatures are rejected", () => {
  const payload = "{}";
  const secret = "whsec_test_secret";
  const timestamp = Math.floor(Date.now() / 1000) - 1000;
  const digest = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`, "utf8")
    .digest("hex");
  assert.equal(
    verifyStripeWebhookSignature(
      payload,
      `t=${timestamp},v1=${digest}`,
      secret,
      300
    ),
    false
  );
});

test("incomplete Stripe subscriptions never normalize to paid access", () => {
  assert.equal(normalizeStripeSubscriptionStatus("active"), "active");
  assert.equal(normalizeStripeSubscriptionStatus("trialing"), "trialing");
  assert.equal(normalizeStripeSubscriptionStatus("past_due"), "past_due");
  assert.equal(normalizeStripeSubscriptionStatus("incomplete"), "suspended");
  assert.equal(normalizeStripeSubscriptionStatus("unpaid"), "suspended");
  assert.equal(normalizeStripeSubscriptionStatus("canceled"), "canceled");
});

test("invoice subscription resolution supports the current parent object graph", () => {
  assert.equal(
    stripeSubscriptionIdFromInvoice({
      parent: { subscription_details: { subscription: "sub_current" } }
    }),
    "sub_current"
  );
  assert.equal(
    stripeSubscriptionIdFromInvoice({
      parent: { subscription_details: { subscription: { id: "sub_expanded" } } }
    }),
    "sub_expanded"
  );
});

test("subscription period end supports legacy root and current item object graphs", () => {
  const legacyUnix = 1793994744;
  const currentUnix = 1796673144;

  assert.equal(
    stripePeriodEnd({ current_period_end: legacyUnix }),
    new Date(legacyUnix * 1000).toISOString()
  );
  assert.equal(
    stripePeriodEnd({
      items: { data: [{ current_period_end: currentUnix }] }
    }),
    new Date(currentUnix * 1000).toISOString()
  );
  assert.equal(
    stripePeriodEnd({
      current_period_end: legacyUnix,
      items: { data: [{ current_period_end: currentUnix }] }
    }),
    new Date(legacyUnix * 1000).toISOString()
  );
  assert.equal(stripePeriodEnd({ items: { data: [] } }), null);
});

test("Stripe webhook route reads raw body before JSON parsing", () => {
  const source = fs.readFileSync(
    new URL("../app/api/billing/stripe-webhook/route.ts", import.meta.url),
    "utf8"
  );
  assert.ok(source.includes("const payload = await request.text()"));
  assert.ok(source.includes("verifyStripeWebhookSignature(payload, signature)"));
  assert.ok(!source.includes("await request.json()"));
});
