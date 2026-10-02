import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(
  new URL("../docs/migrations/20261002133000_lock_free_preview_capabilities.sql", import.meta.url),
  "utf8"
);
const checkout = fs.readFileSync(
  new URL("../app/api/billing/checkout/route.ts", import.meta.url),
  "utf8"
);
const stripe = fs.readFileSync(
  new URL("../lib/stripe-billing.ts", import.meta.url),
  "utf8"
);
const legal = fs.readFileSync(
  new URL("../components/CommercialLegalPage.tsx", import.meta.url),
  "utf8"
);
const pricing = fs.readFileSync(
  new URL("../components/PricingPage.tsx", import.meta.url),
  "utf8"
);

test("free preview can draft but cannot publish, export, host, or collect leads", () => {
  assert.ok(migration.includes("Free preview lock"));
  assert.ok(migration.includes("else 'free'"));
  assert.match(migration, /can_publish[\s\S]*?paid_run/);
  assert.match(migration, /can_export[\s\S]*?paid_run/);
  assert.match(migration, /can_collect_leads[\s\S]*?paid_run/);
  assert.match(migration, /public_site_available[\s\S]*?paid_run/);
  assert.ok(migration.includes("state in ('free','trial','active','grace')"));
});

test("Site Builder never sends a free subscription trial to Stripe", () => {
  assert.ok(checkout.includes("function configuredTrialDays"));
  assert.ok(checkout.includes("return 0"));
  assert.doesNotMatch(checkout, /AJG_SUBSCRIPTION_TRIAL_DAYS/);
  assert.doesNotMatch(stripe, /trial_period_days/);
});

test("commercial copy positions free access as qualitative preview only", () => {
  assert.ok(legal.includes("ne propose pas d’essai Stripe gratuit"));
  assert.ok(legal.includes("sans publication, hébergement, domaine personnalisé, export"));
  assert.ok(pricing.includes("Le gratuit donne un aperçu représentatif"));
  assert.ok(pricing.includes("publishing, hosting, domains, export"));
});
