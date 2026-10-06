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
const followUpRoute = fs.readFileSync(
  new URL("../app/api/admin/beta-followups/route.ts", import.meta.url),
  "utf8"
);
const followUpMigration = fs.readFileSync(
  new URL("../supabase/migrations/20261006171500_beta_followup_history.sql", import.meta.url),
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
  assert.match(admin, /type BetaOpsFilter = "all" \| "followup" \| "unresponsive" \| "blocked" \| "active" \| "complete"/);
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


test("beta follow-up history is service-only, indexed and protected by RLS", () => {
  assert.match(followUpMigration, /create table public\.beta_followups/);
  assert.match(followUpMigration, /enable row level security/);
  assert.match(followUpMigration, /revoke all on public\.beta_followups from anon, authenticated/);
  assert.match(followUpMigration, /beta_followups_user_sent_idx/);
  assert.match(followUpMigration, /beta_followups_site_idx/);
  assert.match(followUpMigration, /beta_followups_admin_idx/);
});

test("admin records a follow-up explicitly and blocks same-step duplicates for 24 hours", () => {
  assert.match(followUpRoute, /mission_next_action/);
  assert.match(followUpRoute, /ageHours < 24/);
  assert.match(followUpRoute, /déjà été enregistrée dans les dernières 24 h/);
  assert.match(followUpRoute, /role\?\.role !== "admin"/);
  assert.match(adminClient, /adminRecordBetaFollowUp/);
  assert.match(admin, /Marquer envoyée/);
  assert.match(admin, /Relance enregistrée/);
});

test("cohort suppresses duplicate reminders while waiting and escalates no-response after 72 hours", () => {
  assert.match(route, /from\("beta_followups"\)/);
  assert.match(route, /awaitingResume/);
  assert.match(route, /overdueAfterFollowUp/);
  assert.match(route, /activityAfterFollowUp/);
  assert.match(route, /followUpAgeHours < 72/);
  assert.match(route, /aucune reprise d’activité n’a été observée depuis plus de 72 h/);
  assert.match(admin, /Sans reprise/);
  assert.match(admin, /activité reprise/);
  assert.match(admin, /en attente de reprise/);
});
