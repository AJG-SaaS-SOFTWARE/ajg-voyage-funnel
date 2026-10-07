import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(
  new URL("../app/api/admin/visual-review/route.ts", import.meta.url),
  "utf8"
);
const readiness = fs.readFileSync(
  new URL("../app/api/admin/release-readiness/route.ts", import.meta.url),
  "utf8"
);
const admin = fs.readFileSync(
  new URL("../app/admin/page.tsx", import.meta.url),
  "utf8"
);
const adminLib = fs.readFileSync(
  new URL("../lib/admin.ts", import.meta.url),
  "utf8"
);
const migration = fs.readFileSync(
  new URL("../supabase/migrations/20261007111000_release_visual_review_journal.sql", import.meta.url),
  "utf8"
);

test("visual review journal is service-role only and stores minimal sign-off data", () => {
  assert.match(migration, /create table if not exists public\.release_visual_reviews/);
  assert.match(migration, /alter table public\.release_visual_reviews enable row level security/);
  assert.match(migration, /revoke all on public\.release_visual_reviews from anon, authenticated/);
  assert.match(migration, /grant select, insert, update, delete on public\.release_visual_reviews to service_role/);
  assert.match(migration, /unique \(deployment_sha, locale, viewport, surface_set_version\)/);
  assert.doesNotMatch(migration, /screenshot|notes|email|message|reviewed_by/i);
});

test("visual review API requires admin role and a deployed SHA", () => {
  assert.match(route, /\.from\("user_roles"\)/);
  assert.match(route, /role\?\.role !== "admin"/);
  assert.match(route, /process\.env\.AJG_RELEASE_SHA \|\|/);
  assert.match(route, /process\.env\.VERCEL_GIT_COMMIT_SHA/);
  assert.match(route, /Deployment SHA unavailable/);
  assert.match(route, /SURFACE_SET_VERSION = "customer-core-v1"/);
});

test("visual review API only accepts the four locale and viewport combinations", () => {
  assert.match(route, /body\?\.locale === "fr" \|\| body\?\.locale === "en"/);
  assert.match(route, /body\?\.viewport === "desktop" \|\| body\?\.viewport === "mobile"/);
  assert.match(route, /typeof approved !== "boolean"/);
  assert.match(route, /onConflict: "deployment_sha,locale,viewport,surface_set_version"/);
  assert.match(route, /"fr:desktop", "fr:mobile", "en:desktop", "en:mobile"/);
});

test("release readiness only accepts visual sign-offs for the current SHA and surface set", () => {
  assert.match(readiness, /\.from\("release_visual_reviews"\)/);
  assert.match(readiness, /\.eq\("deployment_sha", deploymentSha!\)/);
  assert.match(readiness, /\.eq\("surface_set_version", "customer-core-v1"\)/);
  assert.match(readiness, /key: "visual-review-fr-en"/);
  assert.match(readiness, /"fr:desktop"/);
  assert.match(readiness, /"en:mobile"/);
});

test("admin UI exposes the four SHA-bound visual review sign-offs", () => {
  assert.match(adminLib, /getAdminVisualReview/);
  assert.match(adminLib, /adminSetVisualReview/);
  assert.match(admin, /Revue FR\/EN · desktop \+ mobile/);
  assert.match(admin, /\(\["fr", "en"\] as const\)\.flatMap/);
  assert.match(admin, /\(\["desktop", "mobile"\] as const\)\.map/);
  assert.match(admin, /saveVisualReview\(locale, viewport, !approved\)/);
  assert.match(admin, /Ce contrôle atteste une revue humaine/);
});
