import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const source = fs.readFileSync(new URL("../lib/business-reporting.ts", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../app/api/health/business/route.ts", import.meta.url), "utf8");

test("Builder Cockpit report is private and aggregate-only", () => {
  assert.match(route, /AJG_COCKPIT_REPORTING_TOKEN/);
  assert.match(route, /authorization/);
  assert.doesNotMatch(source, /owner_id|user_id|email|site_id|provider_customer_id|provider_subscription_id/);
  assert.doesNotMatch(source, /select\("\*"\)/);
});

test("Builder MRR uses configured Stripe price ids for monthly versus annual", () => {
  assert.match(source, /STRIPE_ESSENTIAL_MONTHLY_PRICE_ID/);
  assert.match(source, /STRIPE_ESSENTIAL_ANNUAL_PRICE_ID/);
  assert.match(source, /STRIPE_GROWTH_MONTHLY_PRICE_ID/);
  assert.match(source, /STRIPE_GROWTH_ANNUAL_PRICE_ID/);
  assert.match(source, /Math\.round\(price\.amountCents \/ 12\)/);
});

test("Builder report excludes free plans and practitioner payment volume", () => {
  assert.match(source, /\["essential", "growth"\]\.includes\(row\.plan_key\)/);
  assert.match(source, /processedVolume30dCents: 0/);
  assert.match(source, /connectedAccounts: 0/);
});

test("Builder report distinguishes provider failures from normal dunning", () => {
  assert.match(source, /failedProviderEvents > 0/);
  assert.match(source, /"critical"/);
  assert.match(source, /pastDueCustomers/);
  assert.match(source, /"warning"/);
});

test("Builder report does not invent churn or trial conversion", () => {
  assert.match(source, /churn30dPct: null/);
  assert.match(source, /trialConversion30dPct: null/);
});


test("Builder report exposes only aggregate commercial launch readiness", () => {
  assert.match(source, /commercialLaunch:/);
  assert.match(source, /state: commercialLaunchState/);
  assert.match(source, /checkoutEnabled/);
  assert.match(source, /blockerCount: commercial\.reasons\.length/);
  assert.match(source, /legalReady: commercialConfig\.legal\.ok/);
  assert.match(source, /taxReady: commercialConfig\.tax\.ok/);
  assert.match(source, /stripeConfigured: commercialConfig\.stripe\.ok/);
  assert.match(source, /stripeRuntimeReady/);
  assert.doesNotMatch(source, /commercialLaunch:\s*{[^}]*\breasons\s*:/s);
});

test("Builder report treats an enabled but non-ready Checkout as critical", () => {
  assert.match(source, /commercialLaunchState === "blocked"/);
  assert.match(source, /failedProviderEvents > 0/);
  assert.match(source, /commercialLaunchState === "blocked"/);
  assert.match(source, /betaOperations\.status === "failed"/);
  assert.match(source, /Checkout ELTARA est activé alors que la readiness commerciale n’est pas conforme/);
});


test("Builder report exposes only aggregate beta-operations state", () => {
  assert.match(source, /from\("beta_operations_runs"\)/);
  assert.match(source, /active_tester_count/);
  assert.match(source, /follow_up_candidates/);
  assert.match(source, /awaiting_resume/);
  assert.match(source, /unresponsive_after_followup/);
  assert.match(source, /completed_missions/);
  assert.match(source, /betaOperations,/);
  assert.doesNotMatch(source, /betaOperations:\s*{[^}]*\b(?:user|email|site|owner)\b/s);
});

test("Builder report turns beta agent state into aggregate operational severity", () => {
  assert.match(source, /betaOperations\.status === "failed"/);
  assert.match(source, /betaOperations\.status === "attention"/);
  assert.match(source, /betaOperations\.status === "unavailable"/);
  assert.match(source, /relance\(s\) Beta Tester à préparer/);
  assert.match(source, /sans reprise après relance/);
});

test("missing beta journal degrades reporting without exposing or inventing tester identities", () => {
  assert.match(source, /status: "unavailable" as const/);
  assert.match(source, /activeTesterCount: 0/);
  assert.match(source, /checkedAt: null/);
  assert.match(source, /dernier état agrégé du suivi bêta ELTARA est indisponible/);
});


test("Builder report exposes aggregate beta runtime readiness without deployment identity", () => {
  assert.match(source, /auditOpenAiRuntimeCached\(\)/);
  assert.match(source, /from\("builder_e2e_runs"\)/);
  assert.match(source, /releaseE2ERunDecision/);
  assert.match(source, /betaRuntime = \{/);
  assert.match(source, /openAi: openAiRuntime\.status/);
  assert.match(source, /e2eMirror: e2eMirrorState/);
  assert.match(source, /validatedLocales/);
  assert.match(source, /requiredLocales: 2/);
  assert.match(source, /betaRuntime,/);
  assert.doesNotMatch(source, /betaRuntime = \{[^}]*deploymentSha/s);
});

test("Builder report escalates invalid AI runtime and exhausted mirrored E2E", () => {
  assert.match(source, /betaRuntime\.openAi === "blocker"/);
  assert.match(source, /betaRuntime\.e2eMirror === "blocked"/);
  assert.match(source, /fournisseur IA refuse la configuration runtime ELTARA/);
  assert.match(source, /miroir E2E FR\/EN du déploiement courant a épuisé son budget/);
});

test("Builder report treats pending or unavailable mirrored E2E as warning, not automatic critical", () => {
  assert.match(source, /\["pending", "unavailable"\]\.includes\(betaRuntime\.e2eMirror\)/);
  assert.match(source, /Validation E2E miroir en attente/);
  assert.match(source, /état E2E miroir du déploiement courant est indisponible/);
});
