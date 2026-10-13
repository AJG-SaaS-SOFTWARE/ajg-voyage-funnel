import test from "node:test";
import assert from "node:assert/strict";
import { summarizeAiRecipeMetrics } from "../lib/ai-recipe-metrics.ts";

test("recipe aggregates successful usage and preserves uncertain failure exposure separately", () => {
  const result = summarizeAiRecipeMetrics([
    { operation: "premium_creation", duration_ms: 1200, estimated_cost_usd_micros: 1000, pricing_known: true },
    { operation: "premium_refinement", duration_ms: 400, estimated_cost_usd_micros: 400, pricing_known: false }
  ], [{ state: "settled", charged_micros: 1000 }, { state: "uncertain", charged_micros: 6000 }], 1800);
  assert.equal(result.providerCalls, 2);
  assert.equal(result.settledUsdMicros, 1000);
  assert.equal(result.uncertainCeilingUsdMicros, 6000);
  assert.equal(result.repairCalls, 1);
  assert.equal(result.unpricedUsageCalls, 1);
  assert.equal(result.providerDurationMs, 1600);
  assert.ok(!Object.keys(result).some(key => /user|site|prompt|output|request/i.test(key)));
});

test("absent or invalid metrics cannot masquerade as a free generation", () => {
  assert.throws(() => summarizeAiRecipeMetrics([], [], 0), /costs_missing/);
  assert.throws(() => summarizeAiRecipeMetrics([], [{ state: "settled", charged_micros: -1 }], 0), /invalid_recipe/);
  assert.throws(() => summarizeAiRecipeMetrics([], [{ state: "unknown", charged_micros: 0 }], 0), /invalid_recipe/);
  assert.equal(summarizeAiRecipeMetrics([], [{ state: "reserved", charged_micros: 300 }], 100).uncertainCeilingUsdMicros, 300);
});
