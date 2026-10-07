import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const checkout = fs.readFileSync(new URL("../app/api/billing/checkout/route.ts", import.meta.url), "utf8");
const webhook = fs.readFileSync(new URL("../app/api/billing/stripe-webhook/route.ts", import.meta.url), "utf8");
const stripe = fs.readFileSync(new URL("../lib/stripe-billing.ts", import.meta.url), "utf8");
const subscription = fs.readFileSync(new URL("../lib/subscription.ts", import.meta.url), "utf8");
const aiRoute = fs.readFileSync(new URL("../app/api/ai/write/route.ts", import.meta.url), "utf8");
const readiness = fs.readFileSync(new URL("../app/api/admin/release-readiness/route.ts", import.meta.url), "utf8");
const commercialReadiness = fs.readFileSync(new URL("../lib/commercial-checkout-readiness.ts", import.meta.url), "utf8");
const env = fs.readFileSync(new URL("../.env.example", import.meta.url), "utf8");

test("billing catalogue supports BUILD RUN GROW", () => {
  for (const key of [
    "STRIPE_ESSENTIAL_MONTHLY_PRICE_ID",
    "STRIPE_ESSENTIAL_ANNUAL_PRICE_ID",
    "STRIPE_GROWTH_MONTHLY_PRICE_ID",
    "STRIPE_GROWTH_ANNUAL_PRICE_ID",
    "STRIPE_AI_LAUNCH_PRICE_ID"
  ]) assert.ok(env.includes(key), key);
  assert.ok(subscription.includes('"free" | "essential" | "growth"'));
  assert.ok(env.includes("AJG_AI_LAUNCH_OPERATIONS=4"));
  assert.ok(env.includes("ELTARA has no free Stripe trial"));
  assert.ok(!env.includes("AJG_SUBSCRIPTION_TRIAL_DAYS"));
});

test("checkout keeps commercial charging closed by an explicit server gate", () => {
  assert.ok(checkout.includes("AJG_BILLING_CHECKOUT_ENABLED"));
  assert.ok(checkout.includes('body?.planKey === "growth"'));
  assert.ok(checkout.includes('body?.purchaseType === "ai_launch"'));
  assert.ok(checkout.includes("STRIPE_AI_LAUNCH_PRICE_ID"));
  assert.ok(checkout.includes("return 0"));
  assert.ok(!stripe.includes("trial_period_days"));
  assert.ok(stripe.includes('mode: "payment"'));
  assert.ok(stripe.includes('purchase_type: "ai_launch"'));
});

test("webhook maps new recurring prices and grants BUILD idempotently", () => {
  for (const key of [
    "STRIPE_ESSENTIAL_MONTHLY_PRICE_ID",
    "STRIPE_ESSENTIAL_ANNUAL_PRICE_ID",
    "STRIPE_GROWTH_MONTHLY_PRICE_ID",
    "STRIPE_GROWTH_ANNUAL_PRICE_ID"
  ]) assert.ok(webhook.includes(key), key);
  assert.ok(webhook.includes('entry is [string, "essential" | "growth"]'));
  assert.ok(webhook.includes("site_ai_launch_entitlements"));
  assert.ok(webhook.includes('source: "stripe_purchase"'));
  assert.ok(webhook.includes('source: "growth_annual"'));
  assert.ok(webhook.includes("ignoreDuplicates: true"));
});

test("AI Architect separates BUILD creation from Growth revisions", () => {
  assert.ok(aiRoute.includes("get_my_site_ai_access"));
  assert.ok(aiRoute.includes("reserve_my_site_launch_operation"));
  assert.ok(aiRoute.includes("commit_my_site_launch_operation"));
  assert.ok(aiRoute.includes("release_my_site_launch_operation"));
  assert.ok(aiRoute.includes("ai_launch_required"));
  assert.ok(aiRoute.includes("growth_or_ai_launch_required"));
  assert.ok(aiRoute.includes("unmetered_growth"));
});

test("commercial readiness requires the complete new catalogue and cost guardrails", () => {
  for (const key of [
    "STRIPE_ESSENTIAL_MONTHLY_PRICE_ID",
    "STRIPE_ESSENTIAL_ANNUAL_PRICE_ID",
    "STRIPE_GROWTH_MONTHLY_PRICE_ID",
    "STRIPE_GROWTH_ANNUAL_PRICE_ID",
    "STRIPE_AI_LAUNCH_PRICE_ID",
    "STRIPE_PORTAL_CONFIGURATION_ID",
    "AJG_COMMERCIAL_LEGAL_READY",
    "AJG_COMMERCIAL_TAX_READY"
  ]) assert.ok(commercialReadiness.includes(key), key);
  assert.ok(readiness.includes("AJG_AI_LAUNCH_OPERATIONS"));
  assert.ok(readiness.includes("AJG_BILLING_CHECKOUT_ENABLED"));
  assert.ok(stripe.includes("STRIPE_PORTAL_CONFIGURATION_ID"));
});

test("B2B checkout collects billing identity but automatic tax remains explicitly gated", () => {
  assert.ok(stripe.includes('billing_address_collection: "required"'));
  assert.ok(stripe.includes('tax_id_collection: { enabled: true, required: "if_supported" }'));
  assert.ok(stripe.includes("AJG_STRIPE_TAX_ENABLED"));
  assert.ok(stripe.includes('commercial_market: "b2b"'));
  assert.ok(commercialReadiness.includes("AJG_VAT_REGIME"));
  assert.ok(commercialReadiness.includes("franchise_base"));
  assert.ok(commercialReadiness.includes("vat_registered"));
  assert.ok(commercialReadiness.includes("txcd_10103001"));
});


test("Growth heavy AI work has a separate bounded monthly allowance", () => {
  const migration = fs.readFileSync(
    new URL("../docs/migrations/20260929234000_bound_growth_heavy_ai_usage.sql", import.meta.url),
    "utf8"
  );
  assert.ok(migration.includes("heavy_ai_monthly_limit=12"));
  assert.ok(migration.includes("v_limit:=30"));
  assert.ok(migration.includes("reserve_my_site_heavy_ai"));
  assert.ok(migration.includes("release_my_site_heavy_ai"));
  assert.ok(aiRoute.includes("reserve_my_site_heavy_ai"));
  assert.ok(aiRoute.includes("release_my_site_heavy_ai"));
  assert.ok(aiRoute.includes("heavyAiReserved"));
  assert.ok(aiRoute.includes("Votre quota mensuel d’opérations Growth lourdes est atteint"));
});

test("AI Launch cannot be purchased while the subscription is past due", () => {
  assert.ok(checkout.includes('!["active", "trialing"].includes(current.status)'));
});
