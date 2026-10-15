import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/builder-e2e-journal.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
new Function("module", "exports", code)(module, module.exports);
const { finishBuilderE2EJournal, validBuilderE2ERunId } = module.exports;
const patch = { status: "success", completed_at: "2026-10-15T06:00:00.000Z", failure_stage: null, detail: null, steps: [] };

function service(result, throws = false) {
  const calls = [];
  return { calls, from(table) {
    calls.push(["from", table]);
    const query = {
      update(value) { calls.push(["update", value]); return query; },
      eq(key, value) { calls.push(["eq", key, value]); return query; },
      select(value) { calls.push(["select", value]); return query; },
      async single() { if (throws) throw new Error("synthetic timeout"); return result; }
    };
    return query;
  } };
}

test("recipe journal accepts only positive safe integer IDs before any action", async () => {
  for (const id of [null, undefined, "1", 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(validBuilderE2ERunId(id), false);
    const db = service({});
    assert.ok((await finishBuilderE2EJournal(db, id, patch)).error);
    assert.deepEqual(db.calls, []);
  }
  assert.equal(validBuilderE2ERunId(1), true);
});

test("recipe completion confirms its exact terminal row and running-state precondition", async () => {
  for (const status of ["success", "failed", "cleanup_failed"]) {
    const db = service({ data: { id: 12, status, completed_at: "2026-10-15T06:00:00+00:00" }, error: null });
    assert.equal((await finishBuilderE2EJournal(db, 12, { ...patch, status })).error, null);
    assert.ok(db.calls.some(call => call[0] === "eq" && call[1] === "id" && call[2] === 12));
    assert.ok(db.calls.some(call => call[0] === "eq" && call[1] === "status" && call[2] === "running"));
  }
});

test("zero rows, wrong identity/status/time and database errors cannot prove completion", async () => {
  for (const result of [
    { data: null, error: null },
    { data: { id: 13, ...patch }, error: null },
    { data: { id: 12, ...patch, status: "running" }, error: null },
    { data: { id: 12, ...patch, completed_at: null }, error: null },
    { data: { id: 12, ...patch, completed_at: "invalid" }, error: null },
    { data: { id: 12, ...patch, completed_at: "2026-10-15T05:00:00Z" }, error: null },
    { data: { id: 12, ...patch }, error: { code: "synthetic" } }
  ]) assert.ok((await finishBuilderE2EJournal(service(result), 12, patch)).error);
});

test("uncertain journal write is reported without retry or leaking transport details", async () => {
  const db = service({}, true);
  assert.deepEqual(await finishBuilderE2EJournal(db, 12, patch), { error: "journal_completion_unconfirmed" });
  assert.equal(db.calls.filter(call => call[0] === "update").length, 1);
});
