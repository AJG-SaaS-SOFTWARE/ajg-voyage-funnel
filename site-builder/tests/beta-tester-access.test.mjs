import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const grantMigration = fs.readFileSync(
  new URL("../docs/migrations/20260929_add_beta_tester_full_access.sql", import.meta.url),
  "utf8"
);
const hardeningMigration = fs.readFileSync(
  new URL("../docs/migrations/20260929_harden_beta_tester_access.sql", import.meta.url),
  "utf8"
);
const route = fs.readFileSync(
  new URL("../app/api/admin/beta-cohort/route.ts", import.meta.url),
  "utf8"
);
const plans = fs.readFileSync(
  new URL("../app/plans/page.tsx", import.meta.url),
  "utf8"
);

test("Beta Tester grants are expiring and override entitlements without Stripe", () => {
  assert.ok(grantMigration.includes("beta_access_grants"));
  assert.ok(grantMigration.includes("expires_at > starts_at"));
  assert.ok(grantMigration.includes("public.has_active_beta_access() then 'pro'"));
  assert.ok(grantMigration.includes("public.has_active_beta_access() then 'active'"));
});

test("Beta grant table is owner-readable only and entitlement helpers use invoker security", () => {
  assert.ok(hardeningMigration.includes("beta_access_grants_select_own"));
  assert.ok(hardeningMigration.includes("(select auth.uid()) = user_id"));
  assert.ok(hardeningMigration.includes("security invoker"));
});

test("admin Beta Tester API supports bounded duration and revocation", () => {
  assert.ok(route.includes("durationDaysRaw"));
  assert.ok(route.includes("durationDaysRaw >= 1 && durationDaysRaw <= 90"));
  assert.ok(route.includes('.from("beta_access_grants")'));
  assert.ok(route.includes("active: false"));
  assert.ok(route.includes("beta_access_expires_at"));
});

test("account pricing reflects Essential and Pro AI commercial grid", () => {
  assert.ok(plans.includes("Essentiel"));
  assert.ok(plans.includes("Pro IA"));
  assert.ok(plans.includes("19 €"));
  assert.ok(plans.includes("190 €"));
  assert.ok(plans.includes("39 €"));
  assert.ok(plans.includes("390 €"));
  assert.ok(plans.includes("Beta Tester"));
  assert.ok(plans.includes("Accès Pro IA complet offert pendant la bêta"));
  assert.ok(plans.includes('locale === "en" ? "/pricing" : "/tarifs"'));
  assert.ok(plans.includes('"month"'));
  assert.ok(plans.includes('"year"'));
});
