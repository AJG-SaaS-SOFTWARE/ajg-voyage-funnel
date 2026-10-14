import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const module = { exports: {} };
const code = ts.transpileModule(fs.readFileSync(new URL("../lib/support-agent-status.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
new Function("module", "exports", code)(module, module.exports);
const { supportAgentStatus } = module.exports;
const verified = { status: "healthy", completed_at: "2026-10-14T16:00:00Z", runtime_status: "healthy" };
const now = new Date("2026-10-14T16:30:00Z");

test("only a completed and verified healthy support operation is healthy", () => {
  assert.equal(supportAgentStatus(verified, now), "healthy");
  for (const patch of [
    { status: "running" }, { status: "attention" }, { status: "unexpected" },
    { completed_at: null }, { runtime_status: null }, { runtime_status: "unknown" },
    { runtime_status: "warning" }, { runtime_status: "incident" }
  ]) assert.equal(supportAgentStatus({ ...verified, ...patch }, now), "attention");
});

test("a technical failure remains failed even when runtime is healthy", () => {
  assert.equal(supportAgentStatus({ ...verified, status: "failed" }, now), "failed");
});

test("stale, invalid and future journal timestamps cannot prove current health", () => {
  for (const completed_at of ["invalid", "2026-10-14T13:29:59Z", "2026-10-14T16:30:01Z"]) {
    assert.equal(supportAgentStatus({ ...verified, completed_at }, now), "attention");
  }
  assert.equal(supportAgentStatus({ ...verified, completed_at: "2026-10-14T13:30:00Z" }, now), "healthy");
});
