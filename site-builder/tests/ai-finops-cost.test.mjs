import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const cost = fs.readFileSync(new URL("../lib/ai-cost.ts", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../app/api/ai/write/route.ts", import.meta.url), "utf8");
const metrics = fs.readFileSync(new URL("../app/api/admin/beta-metrics/route.ts", import.meta.url), "utf8");

test("AI cost estimator is versioned and covers Builder models", () => {
  assert.ok(cost.includes("openai-2026-09-29-standard-short"));
  for (const model of ["gpt-5.6", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"]) {
    assert.ok(cost.includes(model), model);
  }
  assert.ok(cost.includes("input > 272_000"));
});

test("provider telemetry persists cost and commercial dimensions", () => {
  for (const field of [
    "estimated_cost_usd_micros",
    "pricing_version",
    "pricing_known",
    "plan_key",
    "access_source"
  ]) assert.ok(route.includes(field), field);
  assert.ok(route.includes("estimateAiCostUsdMicros"));
});

test("admin metrics aggregate provider cost and surface unpriced calls", () => {
  assert.ok(metrics.includes("estimatedCostUsd"));
  assert.ok(metrics.includes("avgCostUsdPerCall"));
  assert.ok(metrics.includes("unpricedCalls"));
  assert.ok(metrics.includes("pricing_known"));
});
