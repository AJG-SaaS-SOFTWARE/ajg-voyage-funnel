import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const feedback = fs.readFileSync(new URL("../app/feedback/page.tsx", import.meta.url), "utf8");
const metrics = fs.readFileSync(new URL("../app/api/admin/beta-metrics/route.ts", import.meta.url), "utf8");
const admin = fs.readFileSync(new URL("../app/admin/page.tsx", import.meta.url), "utf8");

test("beta feedback keeps the simulated Essential or Growth context visible and switchable", () => {
  assert.match(feedback, /BetaExperienceSwitch/);
  assert.match(feedback, /readBetaExperienceMode/);
  assert.match(feedback, /writeBetaExperienceMode/);
  assert.match(feedback, /betaExperienceMode === "growth"/);
  assert.match(feedback, /Votre retour sera analysé dans le contexte du parcours/);
});

test("feedback submission records only the current beta mode event before the feedback row", () => {
  const modeEvent = feedback.indexOf('betaExperienceMode === "growth" ? "beta_growth_selected" : "beta_essential_selected"');
  const submission = feedback.indexOf("await submitFeedback");
  assert.ok(modeEvent >= 0);
  assert.ok(submission > modeEvent);
  assert.doesNotMatch(feedback, /trackProductEvent\([^)]*message/s);
});

test("admin attributes feedback from the latest prior beta mode without reading feedback text", () => {
  assert.match(metrics, /feedbackWithExperience/);
  assert.match(metrics, /eventAt > feedbackAt/);
  assert.match(metrics, /event\.user_id !== item\.user_id/);
  assert.match(metrics, /event\.site_id !== item\.site_id/);
  assert.match(metrics, /byExperience/);
  assert.match(metrics, /essentialFeedbackRows/);
  assert.match(metrics, /growthFeedbackRows/);
  assert.doesNotMatch(metrics, /\.select\([^\n]*message/);
});

test("admin cockpit separates feedback volume and rating for Essential and Growth", () => {
  assert.match(admin, /Feedback Essentiel/);
  assert.match(admin, /Feedback Growth/);
  assert.match(admin, /feedback\.byExperience\.essential\.averageRating/);
  assert.match(admin, /feedback\.byExperience\.growth\.averageRating/);
});
