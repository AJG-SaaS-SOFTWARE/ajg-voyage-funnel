import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const checkout = fs.readFileSync(new URL("../app/api/billing/checkout/route.ts", import.meta.url), "utf8");
const webhook = fs.readFileSync(new URL("../app/api/billing/stripe-webhook/route.ts", import.meta.url), "utf8");
const stripe = fs.readFileSync(new URL("../lib/stripe-billing.ts", import.meta.url), "utf8");
const subscription = fs.readFileSync(new URL("../lib/subscription.ts", import.meta.url), "utf8");
const env = fs.readFileSync(new URL("../.env.example", import.meta.url), "utf8");

test("billing catalog supports Essential and Pro monthly and annual prices", () => {
  for (const key of [
    "STRIPE_ESSENTIAL_MONTHLY_PRICE_ID",
    "STRIPE_ESSENTIAL_ANNUAL_PRICE_ID",
    "STRIPE_PRO_MONTHLY_PRICE_ID",
    "STRIPE_PRO_ANNUAL_PRICE_ID"
  ]) assert.ok(env.includes(key));
  assert.ok(subscription.includes('"free" | "essential" | "pro"'));
});

test("checkout is gated and grants a 14 day trial", () => {
  assert.ok(checkout.includes("AJG_BILLING_CHECKOUT_ENABLED"));
  assert.ok(checkout.includes("trialDays: 14"));
  assert.ok(checkout.includes('body?.planKey === "essential"'));
  assert.ok(checkout.includes('body?.billingCycle === "annual"'));
  assert.ok(checkout.includes("beta_access_active"));
  assert.ok(stripe.includes("trial_period_days"));
  assert.ok(stripe.includes("plan_key: input.planKey"));
});

test("webhook maps all commercial prices server-side", () => {
  assert.ok(webhook.includes("STRIPE_ESSENTIAL_MONTHLY_PRICE_ID"));
  assert.ok(webhook.includes("STRIPE_ESSENTIAL_ANNUAL_PRICE_ID"));
  assert.ok(webhook.includes("STRIPE_PRO_MONTHLY_PRICE_ID"));
  assert.ok(webhook.includes("STRIPE_PRO_ANNUAL_PRICE_ID"));
  assert.ok(webhook.includes('entry is [string, "essential" | "pro"]'));
});


test("commercial readiness requires the complete billing catalog and launch gates", () => {
  const readiness = fs.readFileSync(
    new URL("../app/api/admin/release-readiness/route.ts", import.meta.url),
    "utf8"
  );
  for (const key of [
    "STRIPE_ESSENTIAL_MONTHLY_PRICE_ID",
    "STRIPE_ESSENTIAL_ANNUAL_PRICE_ID",
    "STRIPE_PRO_MONTHLY_PRICE_ID",
    "STRIPE_PRO_ANNUAL_PRICE_ID",
    "STRIPE_PORTAL_CONFIGURATION_ID",
    "AJG_COMMERCIAL_LEGAL_READY",
    "AJG_COMMERCIAL_TAX_READY",
    "AJG_BILLING_CHECKOUT_ENABLED"
  ]) assert.ok(readiness.includes(key));
  assert.ok(stripe.includes("STRIPE_PORTAL_CONFIGURATION_ID"));
});
