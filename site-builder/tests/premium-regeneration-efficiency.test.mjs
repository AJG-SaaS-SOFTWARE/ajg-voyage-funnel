import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { reusablePremiumStrategy } from "../lib/premium-site-architect.ts";

const strategy = {
  readiness: "strong",
  understoodNeed: "Présenter une activité de photographie naturelle.",
  audience: "Couples et familles.",
  primaryGoal: "Donner envie de prendre contact.",
  secondaryGoals: ["Montrer l'univers visuel."],
  positioning: "Une approche humaine et peu posée.",
  toneKeywords: ["chaleureux", "élégant"],
  visitorJourney: [
    "Comprendre l'univers",
    "Découvrir l'approche",
    "Prendre contact"
  ],
  contentPriorities: ["Portfolio", "Approche", "Contact"],
  conversionStrategy: "Rassurer avant de proposer la prise de contact.",
  architectureRationale: "Un parcours court suffit.",
  designRationale: "Une composition visuelle met les images au premier plan.",
  missingInformation: [],
  assumptions: []
};

test("a complete audited strategy can be reused for a same-context regeneration", () => {
  const reused = reusablePremiumStrategy(strategy);
  assert.ok(reused);
  assert.equal(reused.primaryGoal, strategy.primaryGoal);
  assert.deepEqual(reused.visitorJourney, strategy.visitorJourney);
});

test("an incomplete strategy falls back to a fresh strategy analysis", () => {
  const reused = reusablePremiumStrategy({
    ...strategy,
    visitorJourney: [],
    contentPriorities: []
  });
  assert.equal(reused, null);
});

test("client reuse is guarded by the exact strategy context fingerprint", () => {
  const source = fs.readFileSync(
    new URL("../app/builder/page.tsx", import.meta.url),
    "utf8"
  );
  assert.ok(source.includes("architectStrategyContextKey === strategyContextKey"));
  assert.ok(source.includes("!extraBrief.trim()"));
  assert.ok(source.includes("reuseStrategy: canReuseStrategy"));
  assert.ok(source.includes("variationReference: canReuseStrategy"));
});

test("regeneration explicitly asks for a materially different alternative", () => {
  const source = fs.readFileSync(
    new URL("../lib/premium-site-architect.ts", import.meta.url),
    "utf8"
  );
  assert.ok(source.includes("create a materially different alternative"));
  assert.ok(source.includes("Do not merely swap synonyms"));
  assert.ok(source.includes("strategyReused"));
});


test("final quality rejection gets one bounded corrective refinement before failing", () => {
  const source = fs.readFileSync(
    new URL("../lib/premium-site-architect.ts", import.meta.url),
    "utf8"
  );
  assert.ok(source.includes("ajg_premium_site_final_correction"));
  assert.ok(source.includes("This is the last correction attempt"));
  assert.ok(source.includes("secondRefinementApplied"));
  assert.ok(source.includes("runFinalQualityReview"));
});
