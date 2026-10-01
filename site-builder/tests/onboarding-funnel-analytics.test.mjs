import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(
  new URL("../supabase/migrations/20261001115500_expand_onboarding_funnel_events.sql", import.meta.url),
  "utf8"
);
const analytics = fs.readFileSync(
  new URL("../lib/product-analytics.ts", import.meta.url),
  "utf8"
);
const builder = fs.readFileSync(
  new URL("../app/builder/page.tsx", import.meta.url),
  "utf8"
);
const metrics = fs.readFileSync(
  new URL("../app/api/admin/beta-metrics/route.ts", import.meta.url),
  "utf8"
);

test("database and client accept all six onboarding steps", () => {
  for (const name of [
    "step_identity",
    "step_story",
    "step_design",
    "step_booking",
    "step_options",
    "step_review"
  ]) {
    assert.ok(migration.includes("'" + name + "'"));
    assert.ok(analytics.includes('"' + name + '"'));
    assert.ok(builder.includes('"' + name + '"'));
  }
});

test("admin metrics expose per-step reach and adjacent drop-offs", () => {
  assert.match(metrics, /steps:\s*\{/);
  assert.match(metrics, /identityToStory/);
  assert.match(metrics, /storyToDesign/);
  assert.match(metrics, /designToBooking/);
  assert.match(metrics, /bookingToOptions/);
  assert.match(metrics, /optionsToReview/);
  assert.match(metrics, /reviewToPublished/);
});
