import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL("../lib/vercel-runtime-health.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const module = { exports: {} };
new Function("require", "module", "exports", code)(require, module, module.exports);
const { summarizeRuntimeRows } = module.exports;

test("runtime health stays healthy without recent errors", () => {
  const now = Date.now();
  const result = summarizeRuntimeRows([
    { level: "info", timestampInMs: now - 2_000, responseStatusCode: 200 },
    { level: "warning", timestampInMs: now - 3_000, responseStatusCode: 429 }
  ], now);
  assert.equal(result.status, "healthy");
  assert.equal(result.errorCount, 0);
  assert.equal(result.http5xxCount, 0);
});

test("runtime health warns on isolated recent errors without exposing messages", () => {
  const now = Date.now();
  const result = summarizeRuntimeRows([
    { level: "error", timestampInMs: now - 1_000, responseStatusCode: 500 }
  ], now);
  assert.equal(result.status, "warning");
  assert.equal(result.errorCount, 1);
  assert.equal(result.http5xxCount, 1);
  assert.equal("message" in result, false);
});

test("runtime health escalates repeated failures or fatal events", () => {
  const now = Date.now();
  const repeated = Array.from({ length: 5 }, (_, index) => ({
    level: "error",
    timestampInMs: now - index * 1_000,
    responseStatusCode: 500
  }));
  assert.equal(summarizeRuntimeRows(repeated, now).status, "incident");
  assert.equal(summarizeRuntimeRows([{ level: "fatal", timestampInMs: now, responseStatusCode: 500 }], now).status, "incident");
});

test("runtime health ignores rows outside the one-hour window", () => {
  const now = Date.now();
  const result = summarizeRuntimeRows([
    { level: "fatal", timestampInMs: now - 2 * 60 * 60 * 1_000, responseStatusCode: 500 }
  ], now);
  assert.equal(result.status, "healthy");
  assert.equal(result.sampledLogs, 0);
});
