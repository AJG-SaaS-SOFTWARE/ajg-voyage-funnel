import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const source = fs.readFileSync(new URL("../lib/business-reporting.ts", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../app/api/health/business/route.ts", import.meta.url), "utf8");

test("Builder Cockpit report is private and aggregate-only", () => {
  assert.match(route, /AJG_COCKPIT_REPORTING_TOKEN/);
  assert.match(route, /authorization/);
  assert.doesNotMatch(source, /owner_id|site_id|provider_customer_id|provider_subscription_id/);
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
  assert.doesNotMatch(source, /commercialLaunch:\s*{[^}]*reasons/s);
});

test("Builder report treats an enabled but non-ready Checkout as critical", () => {
  assert.match(source, /commercialLaunchState === "blocked"/);
  assert.match(source, /failedProviderEvents > 0 \|\| commercialLaunchState === "blocked"/);
  assert.match(source, /Checkout ELTARA est activé alors que la readiness commerciale n’est pas conforme/);
});
