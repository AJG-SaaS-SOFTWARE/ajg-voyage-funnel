import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const plans = fs.readFileSync(new URL("../app/plans/page.tsx", import.meta.url), "utf8");
const billing = fs.readFileSync(new URL("../lib/billing-access.ts", import.meta.url), "utf8");
const checkout = fs.readFileSync(new URL("../app/api/billing/checkout/route.ts", import.meta.url), "utf8");

test("billing state distinguishes a Stripe customer from an active Stripe subscription", () => {
  assert.match(billing, /provider_subscription_id/);
  assert.match(billing, /hasStripeSubscription/);
  assert.match(billing, /\["active", "trialing", "past_due"\]/);
});

test("plan changes use the portal when an active Stripe subscription already exists", () => {
  assert.match(plans, /billingState\?\.hasStripeSubscription/);
  assert.match(plans, /openStripeBillingPortal\(siteId\)/);
  assert.match(plans, /startPlanCheckout\(siteId, planKey, billingCycle\)/);
});

test("frontend routing mirrors the checkout duplicate-subscription guard", () => {
  assert.match(checkout, /code: "existing_subscription"/);
  assert.match(checkout, /provider_subscription_id/);
  assert.match(plans, /without creating a second subscription/);
  assert.match(plans, /sans créer un second abonnement/);
});

test("Beta Tester still cannot enter a paid plan-change flow", () => {
  assert.match(plans, /if \(!siteId \|\| betaAccess\.active\) return/);
});
