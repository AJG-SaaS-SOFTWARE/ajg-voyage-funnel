import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(
  new URL("../supabase/migrations/20261006093311_public_site_analytics_foundation.sql", import.meta.url),
  "utf8"
);
const hardening = fs.readFileSync(
  new URL("../supabase/migrations/20261006093335_harden_public_site_analytics_rate_limits.sql", import.meta.url),
  "utf8"
);
const route = fs.readFileSync(new URL("../app/api/public/analytics/route.ts", import.meta.url), "utf8");
const tracker = fs.readFileSync(new URL("../components/PublicAnalyticsTracker.tsx", import.meta.url), "utf8");
const published = fs.readFileSync(new URL("../components/PublishedSite.tsx", import.meta.url), "utf8");
const contact = fs.readFileSync(new URL("../components/PublicContactForm.tsx", import.meta.url), "utf8");

test("analytics storage is aggregate-first and client writes stay blocked", () => {
  assert.match(migration, /site_analytics_daily/);
  assert.match(migration, /event_count bigint/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.site_analytics_daily from anon/);
  assert.match(migration, /grant select on table public\.site_analytics_daily to authenticated/);
  assert.match(migration, /owners read site analytics/);
  assert.match(migration, /revoke all on function public\.record_site_analytics_event/);
  assert.match(migration, /grant execute on function public\.record_site_analytics_event[^;]+to service_role/s);
  assert.match(hardening, /using\s*\(false\)/);
  assert.match(hardening, /with check\s*\(false\)/);
});

test("public endpoint pseudonymizes abuse control and stores only coarse sources", () => {
  assert.match(route, /createHmac/);
  assert.match(route, /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/);
  assert.match(route, /classifyReferrer/);
  assert.match(route, /record_site_analytics_event/);
  assert.doesNotMatch(route, /sender_email|p_message|p_sender/);
});

test("published pages record views and named CTA clicks without marketing cookies", () => {
  assert.match(tracker, /page_view/);
  assert.match(tracker, /data-eltara-analytics/);
  assert.match(tracker, /sendBeacon/);
  assert.match(published, /PublicAnalyticsTracker/);
  assert.match(published, /data-eltara-analytics="booking"/);
  assert.doesNotMatch(tracker, /document\.cookie|localStorage/);
});

test("native contact funnel records start and successful submission only", () => {
  assert.match(contact, /form_start/);
  assert.match(contact, /form_submit/);
  assert.match(contact, /recordPublicAnalytics/);
  assert.match(contact, /onFocusCapture/);
});
