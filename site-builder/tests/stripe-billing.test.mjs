import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import {
  normalizeStripeSubscriptionStatus,
  stripeInvoiceAccessTransition,
  stripeInvoiceMetadata,
  stripeInvoicePaidThrough,
  stripeInvoicePriceId,
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

test("invoice payload helpers support Stripe 2026 subscription invoice shape", () => {
  const invoice = {
    billing_reason: "subscription_create",
    parent: {
      subscription_details: {
        subscription: "sub_current",
        metadata: {
          site_id: "site_123",
          owner_id: "owner_123",
          plan_key: "essential"
        }
      }
    },
    lines: {
      data: [
        {
          parent: {
            subscription_item_details: {
              subscription: "sub_current",
              subscription_item: "si_123"
            }
          },
          pricing: {
            price_details: {
              price: "price_essential_monthly",
              product: "prod_essential"
            }
          },
          period: { start: 1791316344, end: 1793994744 }
        }
      ]
    },
    period_end: 1791316344
  };

  assert.equal(stripeInvoicePriceId(invoice), "price_essential_monthly");
  assert.deepEqual(stripeInvoiceMetadata(invoice), {
    site_id: "site_123",
    owner_id: "owner_123",
    plan_key: "essential"
  });
  assert.equal(
    stripeInvoicePaidThrough(invoice),
    new Date(1793994744 * 1000).toISOString()
  );
  assert.notEqual(
    stripeInvoicePaidThrough(invoice),
    new Date(invoice.period_end * 1000).toISOString()
  );
});

test("initial payment failure never starts ELTARA grace", () => {
  assert.deepEqual(
    stripeInvoiceAccessTransition("invoice.payment_failed", {
      billing_reason: "subscription_create"
    }),
    {
      providerStatus: "suspended",
      providerEventType: "subscription_pending",
      startsGrace: false
    }
  );
});

test("renewal failure starts grace while payment recovery restores active access", () => {
  assert.deepEqual(
    stripeInvoiceAccessTransition("invoice.payment_failed", {
      billing_reason: "subscription_cycle"
    }),
    {
      providerStatus: "past_due",
      providerEventType: "payment_failed",
      startsGrace: true
    }
  );
  assert.deepEqual(
    stripeInvoiceAccessTransition("invoice.paid", {
      billing_reason: "subscription_cycle"
    }),
    {
      providerStatus: "active",
      providerEventType: "payment_succeeded",
      startsGrace: false
    }
  );
});

test("invoice webhook branch is independent from outbound Stripe subscription retrieval", () => {
  const source = fs.readFileSync(
    new URL("../app/api/billing/stripe-webhook/route.ts", import.meta.url),
    "utf8"
  );
  const invoiceBranch = source.slice(
    source.indexOf('if (event.type === "invoice.paid"'),
    source.indexOf('return NextResponse.json({ received: true, result: "ignored" });')
  );
  assert.ok(invoiceBranch.includes("bindAndApplyInvoice"));
  assert.ok(!invoiceBranch.includes("retrieveStripeSubscription"));
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
