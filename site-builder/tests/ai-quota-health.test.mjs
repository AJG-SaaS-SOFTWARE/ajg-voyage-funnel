import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL("../lib/ai-quota-health.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const module = { exports: {} };
new Function("require", "module", "exports", code)(require, module, module.exports);
const { deriveAiQuotaHealth } = module.exports;

test("AI quota health stays healthy below thresholds", () => {
  const result = deriveAiQuotaHealth({
    planKey: "growth",
    planName: "Growth",
    minuteLimit: 10,
    dailyLimit: 100,
    monthlyLimit: 500,
    minuteUsed: 2,
    dailyUsed: 30,
    monthlyUsed: 120,
    heavyMonthlyLimit: 12,
    heavyMonthlyUsed: 2
  });
  assert.equal(result.status, "healthy");
});

test("AI quota health warns close to a durable quota", () => {
  const result = deriveAiQuotaHealth({
    planKey: "essential",
    planName: "Essentiel",
    minuteLimit: 8,
    dailyLimit: 60,
    monthlyLimit: 250,
    minuteUsed: 1,
    dailyUsed: 55,
    monthlyUsed: 100
  });
  assert.equal(result.status, "near_limit");
});

test("AI quota health reports exhaustion when any enforced window is full", () => {
  const result = deriveAiQuotaHealth({
    planKey: "free",
    planName: "Gratuit",
    minuteLimit: 5,
    dailyLimit: 20,
    monthlyLimit: 80,
    minuteUsed: 5,
    dailyUsed: 5,
    monthlyUsed: 12
  });
  assert.equal(result.status, "exhausted");
});

test("AI quota health reports unavailable when limits cannot be resolved", () => {
  const result = deriveAiQuotaHealth({
    planKey: "unknown",
    planName: "Indisponible",
    minuteLimit: 0,
    dailyLimit: 0,
    monthlyLimit: 0,
    minuteUsed: 0,
    dailyUsed: 0,
    monthlyUsed: 0
  });
  assert.equal(result.status, "unavailable");
});
