import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(
  new URL("../supabase/migrations/20261001120500_onboarding_path_conversion_events.sql", import.meta.url),
  "utf8"
);
const analytics = fs.readFileSync(new URL("../lib/product-analytics.ts", import.meta.url), "utf8");
const home = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const metrics = fs.readFileSync(new URL("../app/api/admin/beta-metrics/route.ts", import.meta.url), "utf8");
const admin = fs.readFileSync(new URL("../app/admin/page.tsx", import.meta.url), "utf8");

test("manual and AI path choices are explicit product events", () => {
  for (const name of ["onboarding_manual_selected", "onboarding_ai_selected"]) {
    assert.ok(migration.includes("'" + name + "'"));
    assert.ok(analytics.includes('"' + name + '"'));
    assert.ok(home.includes('"' + name + '"'));
  }
});

test("path attribution uses the first explicit choice and only later publications", () => {
  assert.match(metrics, /firstPathByUser/);
  assert.match(metrics, /firstPublishByUser/);
  assert.match(metrics, /end < start/);
  assert.match(metrics, /medianHoursToPublish/);
});

test("admin exposes manual versus AI publication and speed", () => {
  assert.match(admin, /onboardingPaths\.manual\.publishRate/);
  assert.match(admin, /onboardingPaths\.ai\.publishRate/);
  assert.match(admin, /onboardingPaths\.aiShare/);
  assert.match(admin, /medianHoursToPublish/);
});
