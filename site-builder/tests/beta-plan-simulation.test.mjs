import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const builder = fs.readFileSync(new URL("../app/builder/page.tsx", import.meta.url), "utf8");
const home = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const plans = fs.readFileSync(new URL("../app/plans/page.tsx", import.meta.url), "utf8");
const switcher = fs.readFileSync(new URL("../components/BetaExperienceSwitch.tsx", import.meta.url), "utf8");
const mode = fs.readFileSync(new URL("../lib/beta-experience-mode.ts", import.meta.url), "utf8");

test("beta simulation defaults to Essential and persists only a local display mode", () => {
  assert.match(mode, /"essential"/);
  assert.match(mode, /window\.localStorage/);
  assert.doesNotMatch(mode, /supabase|stripe|fetch\(/i);
  assert.match(switcher, /Tester l’expérience client/);
  assert.match(switcher, /aucun paiement n’est déclenché/);
});

test("Builder keeps real beta rights but hides Growth and BUILD in Essential simulation", () => {
  assert.match(builder, /betaEssentialSimulation = betaTester && betaExperienceMode === "essential"/);
  assert.match(builder, /actualSiteArchitectCreateAvailable/);
  assert.match(builder, /actualSiteRevisionAvailable/);
  assert.match(builder, /actualSiteArchitectCreateAvailable && \(!betaTester \|\| betaArchitectSimulation\)/);
  assert.match(builder, /actualSiteRevisionAvailable && \(!betaTester \|\| betaGrowthSimulation \|\| betaArchitectSimulation\)/);
  assert.match(builder, /Tester maintenant Growth/);
  assert.match(builder, /Parcours bêta gratuit/);
});

test("dashboard lets beta testers move from Essential to Growth without checkout", () => {
  assert.match(home, /effectiveCanCreateWithAi/);
  assert.match(home, /betaExperienceMode !== "architect" \? false : canCreateWithAi/);
  assert.match(home, /Tester Essentiel/);
  assert.match(home, /Comparer avec Growth/);
  assert.match(home, /Tester Growth/);
  assert.match(home, /changeBetaExperienceMode\("growth"\)/);
});

test("plan page shows simulated Essential, Growth, or BUILD while billing actions stay disabled for beta", () => {
  assert.match(plans, /displayedPlanKey = betaAccess\.active \? \(betaExperienceMode === "architect" \? "essential" : betaExperienceMode\) : current\.planKey/);
  assert.match(plans, /Essentiel · mode test/);
  assert.match(plans, /Growth · mode test/);
  assert.match(plans, /Concepteur IA · mode test/);
  assert.match(plans, /if \(!siteId \|\| betaAccess\.active\) return/);
  assert.match(plans, /sans modifier Stripe ni vos droits réels/);
});


test("beta plan switches are instrumented without storing customer content", () => {
  const analytics = fs.readFileSync(new URL("../lib/product-analytics.ts", import.meta.url), "utf8");
  const metrics = fs.readFileSync(new URL("../app/api/admin/beta-metrics/route.ts", import.meta.url), "utf8");
  assert.match(analytics, /beta_essential_selected/);
  assert.match(analytics, /beta_growth_selected/);
  assert.match(builder, /trackProductEvent/);
  assert.match(metrics, /essentialThenGrowth/);
  assert.match(metrics, /betaEssentialTested/);
  assert.match(metrics, /betaGrowthTested/);
});


test("beta mission progress is reconstructed from the tester's own telemetry", () => {
  const analytics = fs.readFileSync(new URL("../lib/product-analytics.ts", import.meta.url), "utf8");
  assert.match(analytics, /getMyBetaJourneyProgress/);
  assert.match(analytics, /beta_essential_selected/);
  assert.match(analytics, /beta_growth_selected/);
  assert.match(analytics, /publish_success/);
  assert.match(analytics, /user_feedback/);
  assert.match(home, /betaJourney\.essentialTested/);
  assert.match(home, /betaJourney\.growthTested/);
  assert.match(home, /betaJourney\.essentialThenGrowth/);
  assert.match(home, /betaJourney\.feedbackSent/);
  assert.match(home, /getMyBetaJourneyProgress\(remoteSiteId\)/);
});


test("ordered beta completion accepts a later corrected Essential to Growth sequence", () => {
  const analytics = fs.readFileSync(new URL("../lib/product-analytics.ts", import.meta.url), "utf8");
  const metrics = fs.readFileSync(new URL("../app/api/admin/beta-metrics/route.ts", import.meta.url), "utf8");
  assert.match(analytics, /essential\.some\(\(essentialEvent\)/);
  assert.match(analytics, /growth\.some\(\(growthEvent\)/);
  assert.match(metrics, /essentialTimes\.some/);
  assert.match(metrics, /growthTimes\.some/);
  assert.doesNotMatch(metrics, /firstEssentialByUser/);
  assert.doesNotMatch(metrics, /firstGrowthByUser/);
});


test("Beta tester mode switch stays visible in Builder header and admin QA is explicit", () => {
  assert.match(builder, /<BetaExperienceSwitch\s+inline/);
  assert.match(builder, /adminQa/);
  assert.match(builder, /Compte Admin\/QA/);
  assert.match(switcher, /inline = false/);
  assert.match(switcher, /Mode bêta/);
  assert.match(switcher, /GROW/);
});


test("internal admins receive full beta entitlements for QA without Stripe mutation", () => {
  const migration = fs.readFileSync(new URL("../supabase/migrations/20261006120100_admin_beta_entitlements.sql", import.meta.url), "utf8");
  assert.match(migration, /public\.user_roles/);
  assert.match(migration, /ur\.role = 'admin'/);
  assert.match(migration, /create or replace function public\.has_active_beta_access/);
  assert.match(migration, /create or replace function public\.get_my_beta_access/);
  assert.doesNotMatch(migration, /stripe/i);
});


test("beta mission gives a direct next action when switching from RUN to Growth", () => {
  assert.match(home, /Passer en Growth/);
  assert.match(home, /Ouvrir Growth/);
  assert.match(home, /Publier pour tester Growth/);
  assert.match(home, /href="\/growth"/);
  assert.match(builder, /builder-growth-shortcut/);
  assert.match(builder, /betaExperienceMode !== "essential" && published/);
});


test("beta mission shows a six-step progress bar and a deterministic next action", () => {
  assert.match(home, /betaMissionCompleteCount/);
  assert.match(home, /betaMissionPercent/);
  assert.match(home, /Progression de la mission bêta/);
  assert.match(home, /Explorer Growth \+ Analytics/);
  assert.match(home, /Prochaine action/);
  assert.match(home, /betaJourney\.growthExplored/);
  assert.match(home, /betaJourney\.architectTested/);
});

test("beta mission only validates Growth exploration after real Growth and Analytics visits", () => {
  const analyticsLib = fs.readFileSync(new URL("../lib/product-analytics.ts", import.meta.url), "utf8");
  const growthPage = fs.readFileSync(new URL("../app/growth/page.tsx", import.meta.url), "utf8");
  const analyticsPage = fs.readFileSync(new URL("../app/analytics/page.tsx", import.meta.url), "utf8");
  assert.match(analyticsLib, /beta_growth_cockpit_opened/);
  assert.match(analyticsLib, /beta_analytics_opened/);
  assert.match(analyticsLib, /growthExplored:growthCockpitOpened&&analyticsOpened/);
  assert.match(growthPage, /trackProductEvent\("beta_growth_cockpit_opened", selected\.id\)/);
  assert.match(analyticsPage, /trackProductEvent\("beta_analytics_opened", selected\.id\)/);
});
