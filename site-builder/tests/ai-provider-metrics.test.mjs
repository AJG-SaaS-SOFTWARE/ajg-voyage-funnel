import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("standard AI records provider metadata without persisting prompt content", () => {
  const source = fs.readFileSync(
    new URL("../app/api/ai/write/route.ts", import.meta.url),
    "utf8"
  );
  assert.ok(source.includes('"standard_field"'));
  assert.ok(source.includes('"standard_guided"'));
  assert.ok(source.includes('"standard_review"'));
  assert.ok(source.includes('"standard_module"'));
  assert.ok(source.includes('from("ai_provider_usage").insert'));
  assert.ok(source.includes("input_tokens"));
  assert.ok(source.includes("duration_ms"));
  assert.ok(!source.includes("prompt: prompt"));
  assert.ok(!source.includes("generated_text"));
});

test("admin metrics keep standard and Premium provider rows isolated", () => {
  const source = fs.readFileSync(
    new URL("../app/api/admin/beta-metrics/route.ts", import.meta.url),
    "utf8"
  );
  assert.ok(source.includes('startsWith("premium_")'));
  assert.ok(source.includes('startsWith("standard_")'));
  assert.ok(source.includes("premiumProvider = aggregateProviderUsage"));
  assert.ok(source.includes("standardProvider = aggregateProviderUsage"));
  assert.ok(source.includes("avgStrategyCallsPerRequest"));
});

test("standard AI metrics are exposed separately in the admin dashboard", () => {
  const source = fs.readFileSync(
    new URL("../app/admin/page.tsx", import.meta.url),
    "utf8"
  );
  assert.ok(source.includes("Empreinte technique IA standard"));
  assert.ok(source.includes("betaMetrics.ai.standard.provider"));
});
