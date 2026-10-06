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
  assert.match(switcher, /aucun abonnement Stripe n’est modifié/);
});

test("Builder keeps real beta rights but hides Growth and BUILD in Essential simulation", () => {
  assert.match(builder, /betaEssentialSimulation = betaTester && betaExperienceMode === "essential"/);
  assert.match(builder, /actualSiteArchitectCreateAvailable/);
  assert.match(builder, /actualSiteRevisionAvailable/);
  assert.match(builder, /actualSiteArchitectCreateAvailable && !betaEssentialSimulation/);
  assert.match(builder, /actualSiteRevisionAvailable && !betaEssentialSimulation/);
  assert.match(builder, /Tester maintenant l’expérience Growth/);
  assert.match(builder, /passage en Growth est instantané et sans paiement/);
});

test("dashboard lets beta testers move from Essential to Growth without checkout", () => {
  assert.match(home, /effectiveCanCreateWithAi/);
  assert.match(home, /betaExperienceMode === "essential" \? false : canCreateWithAi/);
  assert.match(home, /Tester d’abord Essentiel/);
  assert.match(home, /Passer ensuite en Growth/);
  assert.match(home, /Tester Growth/);
  assert.match(home, /changeBetaExperienceMode\("growth"\)/);
});

test("plan page shows simulated Essential or Growth while billing actions stay disabled for beta", () => {
  assert.match(plans, /displayedPlanKey = betaAccess\.active \? betaExperienceMode : current\.planKey/);
  assert.match(plans, /Essentiel · mode test/);
  assert.match(plans, /Growth · mode test/);
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
