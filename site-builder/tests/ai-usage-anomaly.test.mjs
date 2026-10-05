import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL("../lib/ai-usage-anomaly.ts", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../app/api/admin/ai-finops/route.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/admin/finops/page.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const module = { exports: {} };
new Function("require", "module", "exports", code)(require, module, module.exports);
const { detectAiUsageAnomaly } = module.exports;

test("AI usage anomaly stays healthy for normal low-volume activity", () => {
  const now = Date.now();
  const rows = [];
  for (let i = 0; i < 168; i++) {
    rows.push({ created_at: new Date(now - (i + 2) * 60 * 60 * 1000).toISOString(), charged_micros: 10_000 });
  }
  rows.push({ created_at: new Date(now - 10 * 60 * 1000).toISOString(), charged_micros: 12_000 });
  const result = detectAiUsageAnomaly(rows, now);
  assert.equal(result.status, "healthy");
  assert.equal(result.currentCalls, 1);
});

test("AI usage anomaly warns on a bounded burst and escalates a larger burst", () => {
  const now = Date.now();
  const warningRows = Array.from({ length: 10 }, (_, i) => ({
    created_at: new Date(now - i * 2 * 60 * 1000).toISOString(),
    charged_micros: 120_000
  }));
  assert.equal(detectAiUsageAnomaly(warningRows, now).status, "warning");

  const criticalRows = Array.from({ length: 20 }, (_, i) => ({
    created_at: new Date(now - i * 60 * 1000).toISOString(),
    charged_micros: 180_000
  }));
  assert.equal(detectAiUsageAnomaly(criticalRows, now).status, "critical");
});

test("AI usage anomaly refuses to conclude from a truncated reference sample", () => {
  const result = detectAiUsageAnomaly([], Date.now(), true);
  assert.equal(result.status, "unknown");
  assert.equal(result.checked, false);
});

test("FinOps route queries anomaly data only after admin auth and caps the sample", () => {
  const roleCheck = route.indexOf('role?.role !== "admin"');
  const anomalyQuery = route.indexOf('.from("ai_cost_reservations")');
  assert.ok(roleCheck >= 0 && anomalyQuery > roleCheck);
  assert.match(route, /\.limit\(5000\)/);
  assert.match(route, /usage-anomaly/);
});

test("FinOps admin explains that anomaly detection never changes quotas automatically", () => {
  assert.match(page, /Il ne modifie jamais automatiquement les quotas/);
  assert.match(page, /Échantillon borné/);
});
