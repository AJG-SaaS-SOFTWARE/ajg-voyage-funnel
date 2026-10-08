import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(
  new URL("../docs/migrations/20261002133000_lock_free_preview_capabilities.sql", import.meta.url),
  "utf8"
);
const aiLockMigration = fs.readFileSync(
  new URL("../docs/migrations/20261006193146_lock_free_preview_ai_generation.sql", import.meta.url),
  "utf8"
);
const firstPaymentMigration = fs.readFileSync(
  new URL("../docs/migrations/20261008145512_require_first_paid_period_for_costly_features.sql", import.meta.url),
  "utf8"
);
const publicationGateMigration = fs.readFileSync(
  new URL("../supabase/migrations/20261008151140_enforce_first_payment_on_publication_and_domains.sql", import.meta.url),
  "utf8"
);
const checkout = fs.readFileSync(
  new URL("../app/api/billing/checkout/route.ts", import.meta.url),
  "utf8"
);
const aiWriteRoute = fs.readFileSync(
  new URL("../app/api/ai/write/route.ts", import.meta.url),
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
const siteRepository = fs.readFileSync(
  new URL("../lib/supabase-site-repository.ts", import.meta.url),
  "utf8"
);
const stripeWebhook = fs.readFileSync(
  new URL("../app/api/billing/stripe-webhook/route.ts", import.meta.url),
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

test("free preview cannot consume AI while active paid and beta entitlements can", () => {
  assert.ok(aiLockMigration.includes("Free preview AI lock"));
  assert.ok(
    aiLockMigration.includes(
      "privacy_state='active' and current_run and state in ('active','trial')"
    )
  );
  assert.ok(aiLockMigration.includes("Past-due and grace states suspend AI immediately"));
  assert.ok(aiWriteRoute.includes("get_my_site_capabilities"));
  assert.ok(aiWriteRoute.includes("capability?.can_generate_ai"));
  assert.ok(aiWriteRoute.includes("{ status: 402 }"));
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


test("variable-cost features require a confirmed first payment outside beta", () => {
  assert.ok(firstPaymentMigration.includes("first_payment_confirmed_at"));
  assert.ok(firstPaymentMigration.includes("public.has_active_beta_access()"));
  assert.ok(firstPaymentMigration.includes("p_event_type='payment_succeeded'"));
  assert.ok(firstPaymentMigration.includes("p_event_type='subscription_active'"));
  assert.ok(firstPaymentMigration.includes("v_result := 'projection_updated'"));
  assert.ok(firstPaymentMigration.includes("current_paid_or_beta"));
  assert.ok(firstPaymentMigration.includes("public.can_modify_site_media"));
  assert.doesNotMatch(firstPaymentMigration, /subscription_status in \('active','trialing'\)/);
});

test("AI Launch add-on requires an already paid active subscription", () => {
  assert.ok(checkout.includes("first_payment_confirmed_at"));
  assert.ok(checkout.includes('current.status !== "active"'));
  assert.ok(checkout.includes("!current.first_payment_confirmed_at"));
});


test("publication and domain mutations enforce the first-paid cost gate in versioned Supabase migrations", () => {
  assert.ok(publicationGateMigration.includes("private.eltara_cost_gate_unlocked"));
  assert.ok(publicationGateMigration.includes("enforce_eltara_publication_cost_gate"));
  assert.ok(publicationGateMigration.includes("first_payment_confirmed_at is not null"));
  assert.ok(publicationGateMigration.includes('drop policy if exists "owners insert domains"'));
  assert.ok(publicationGateMigration.includes("private.eltara_cost_gate_unlocked(domains.site_id)"));
  assert.ok(publicationGateMigration.includes("public.has_active_beta_access") === false);
  assert.ok(publicationGateMigration.includes("beta_access_grants"));
});


test("initial publication is created as draft before the paid publication capability is checked", () => {
  assert.ok(siteRepository.includes('const initialPayload = publish'));
  assert.ok(siteRepository.includes('payload(user, publishConfig, "draft")'));
  assert.ok(siteRepository.includes('await assertSiteCapability(remote.id, "can_publish")'));
  assert.ok(siteRepository.indexOf('await assertSiteCapability(remote.id, "can_publish")') < siteRepository.indexOf('update(payload(user, publishConfig, "published"))'));
});

test("Growth annual AI benefit is granted only from the paid invoice path", () => {
  assert.equal((stripeWebhook.match(/source: "growth_annual"/g) || []).length, 1);
  assert.ok(stripeWebhook.includes('const paid = event.type === "invoice.paid"'));
  assert.match(stripeWebhook, /paid &&[\s\S]*source: "growth_annual"/);
});
