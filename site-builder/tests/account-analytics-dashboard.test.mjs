import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../app/analytics/page.tsx", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../components/AccountShell.tsx", import.meta.url), "utf8");
const analytics = fs.readFileSync(new URL("../lib/site-analytics.ts", import.meta.url), "utf8");

test("account navigation exposes analytics as a first-class destination", () => {
  assert.match(shell, /"analytics"/);
  assert.match(shell, /href: "\/analytics"/);
  assert.match(shell, /Analytics/);
  assert.doesNotMatch(shell, />Builder<\/b>/);
});

test("Essential analytics stays measurement-first while Growth adds opportunities", () => {
  assert.match(page, /summary\.views/);
  assert.match(page, /summary\.ctaClicks/);
  assert.match(page, /summary\.formSubmits/);
  assert.match(page, /growthExperience \?/);
  assert.match(page, /Opportunités détectées/);
  assert.match(page, /Transformer les chiffres en actions/);
});

test("beta testers can switch analytics between Essential and Growth experiences", () => {
  assert.match(page, /BetaExperienceSwitch/);
  assert.match(page, /readBetaExperienceMode/);
  assert.match(page, /beta_growth_selected/);
  assert.match(page, /beta_essential_selected/);
});

test("analytics summaries wait for enough signal before suggesting actions", () => {
  assert.match(analytics, /page\.views >= 10/);
  assert.match(analytics, /formStarts >= 5/);
  assert.match(analytics, /views >= 20/);
  assert.match(analytics, /dominantSource\.views \/ views >= 0\.8/);
});


test("analytics supports 7 30 90 day comparisons against the previous period", () => {
  assert.match(page, /\(\[7, 30, 90\] as AnalyticsPeriodDays\[\]\)/);
  assert.match(page, /compareSiteAnalytics\(rows, period\)/);
  assert.match(analytics, /previousStart/);
  assert.match(analytics, /deltaPercent/);
  assert.match(analytics, /actionRatePoints/);
});

test("analytics exposes per-page conversion without inventing unique visitors", () => {
  assert.match(page, /Conversion des pages/);
  assert.match(page, /page\.ctaClicks \+ page\.formSubmits/);
  assert.match(analytics, /actionRate: ratio\(value\.ctaClicks \+ value\.formSubmits, value\.views\)/);
  assert.doesNotMatch(page, /visiteurs uniques|unique visitors/i);
});

test("Growth opportunities lead to concrete builder actions", () => {
  assert.match(page, /if \(key === "cta"\) return "\/builder\?step=story"/);
  assert.match(page, /if \(key === "form"\) return "\/builder\?step=options"/);
  assert.match(page, /return "\/builder\?step=booking"/);
  assert.match(page, /analytics-opportunity-action/);
});
