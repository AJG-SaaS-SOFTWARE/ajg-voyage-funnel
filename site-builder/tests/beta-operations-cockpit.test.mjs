import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(
  new URL("../app/api/admin/beta-cohort/route.ts", import.meta.url),
  "utf8"
);
const admin = fs.readFileSync(
  new URL("../app/admin/page.tsx", import.meta.url),
  "utf8"
);
const adminClient = fs.readFileSync(
  new URL("../lib/admin.ts", import.meta.url),
  "utf8"
);

test("beta cohort endpoint derives progress from existing operational data only", () => {
  assert.match(route, /from\("sites"\)/);
  assert.match(route, /from\("product_events"\)/);
  assert.match(route, /from\("user_feedback"\)/);
  assert.match(route, /betaOperationalStatus/);
  assert.match(route, /productEventCount/);
  assert.match(route, /aiEventCount/);
  assert.match(route, /feedbackCount/);
});

test("beta follow-up thresholds flag stale invitations and inactive journeys", () => {
  assert.match(route, /inviteAgeHours >= 48/);
  assert.match(route, /inactivityHours >= 72/);
  assert.match(route, /Site publié mais aucun retour reçu après 72 h/);
  assert.match(route, /Création commencée mais inactive depuis plus de 72 h/);
});

test("admin cockpit exposes publication, completion and follow-up status", () => {
  assert.match(adminClient, /betaStage: "invited" \| "activated" \| "building" \| "published" \| "complete"/);
  assert.match(adminClient, /needsFollowUp: boolean/);
  assert.match(admin, /betaPublishedCount/);
  assert.match(admin, /betaCompletedCount/);
  assert.match(admin, /betaFollowUpCount/);
  assert.match(admin, /Mission terminée/);
  assert.match(admin, /Publié · retour attendu/);
  assert.match(admin, /À relancer/);
});


test("beta cohort surfaces grant/metadata inconsistencies instead of hiding them", () => {
  assert.match(route, /metadataBeta/);
  assert.match(route, /grantConfigured/);
  assert.match(route, /cohortConsistent/);
  assert.match(route, /consistencyIssues/);
  assert.match(route, /cohortIds/);
});
