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
  assert.match(route, /deriveBetaMissionProgress/);
  assert.match(route, /beta_growth_cockpit_opened/);
  assert.match(route, /beta_analytics_opened/);
  assert.match(route, /growthExplored/);
  assert.match(route, /completedCount/);
  assert.match(route, /missionSummary/);
});

test("beta follow-up thresholds flag stale invitations and inactive journeys", () => {
  assert.match(route, /inviteAgeHours >= 48/);
  assert.match(route, /inactivityHours >= 72/);
  assert.match(route, /missionFollowUpReason/);
  assert.match(route, /Essentiel testé mais aucun site n’a été publié depuis plus de 72 h/);
  assert.match(route, /Growth \+ Analytics ne sont pas tous les deux explorés après 72 h/);
  assert.match(route, /aucun retour n’a été envoyé après 72 h/);
});

test("admin cockpit exposes publication, completion and follow-up status", () => {
  assert.match(adminClient, /betaStage: "invited" \| "activated" \| "building" \| "published" \| "complete"/);
  assert.match(adminClient, /needsFollowUp: boolean/);
  assert.match(admin, /betaPublishedCount/);
  assert.match(admin, /betaCompletedCount/);
  assert.match(admin, /betaFollowUpCount/);
  assert.match(admin, /Mission terminée/);
  assert.match(admin, /betaMissionAverage/);
  assert.match(admin, /Mission bêta · progression cohorte/);
  assert.match(admin, /Growth \+ Analytics/);
  assert.match(admin, /item\.mission\.completedCount/);
  assert.match(admin, /item\.mission\.nextAction/);
  assert.match(admin, /À relancer/);
});


test("beta cohort surfaces grant/metadata inconsistencies instead of hiding them", () => {
  assert.match(route, /metadataBeta/);
  assert.match(route, /grantConfigured/);
  assert.match(route, /cohortConsistent/);
  assert.match(route, /consistencyIssues/);
  assert.match(route, /cohortIds/);
});


test("admin beta mission mirrors the same five tester milestones and exposes the next action", () => {
  assert.match(adminClient, /essentialTested: boolean/);
  assert.match(adminClient, /published: boolean/);
  assert.match(adminClient, /essentialThenGrowth: boolean/);
  assert.match(adminClient, /growthExplored: boolean/);
  assert.match(adminClient, /feedbackSent: boolean/);
  assert.match(adminClient, /nextAction: "essential" \| "publish" \| "compare" \| "growth_explore" \| "feedback" \| "complete"/);
  assert.match(route, /Math\.round\(\(completedCount \/ checks\.length\) \* 100\)/);
  assert.match(admin, /admin-beta-member-step-dots/);
});


test("admin beta operations can filter by follow-up, blockers, active missions and completion", () => {
  assert.match(admin, /type BetaOpsFilter = "all" \| "followup" \| "blocked" \| "active" \| "complete"/);
  assert.match(admin, /betaOpsFilter/);
  assert.match(admin, /À relancer/);
  assert.match(admin, /Bloqués/);
  assert.match(admin, /En cours/);
  assert.match(admin, /Terminés/);
  assert.match(admin, /betaVisibleMembers/);
});

test("admin beta operations ranks members and prepares a contextual follow-up without sending it automatically", () => {
  assert.match(admin, /betaPriority/);
  assert.match(admin, /P1/);
  assert.match(admin, /P2/);
  assert.match(admin, /P3/);
  assert.match(admin, /betaFollowUpMessage/);
  assert.match(admin, /Copier la relance/);
  assert.match(admin, /mailto:/);
  assert.match(admin, /Préparer l’e-mail/);
  assert.doesNotMatch(admin, /sendEmail\(/);
});
