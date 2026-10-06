import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const reconciler = fs.readFileSync(
  new URL("../lib/support-reconcile.ts", import.meta.url),
  "utf8"
);
const cron = fs.readFileSync(
  new URL("../app/api/cron/support-operations/route.ts", import.meta.url),
  "utf8"
);

test("automatic reconciliation only scans self-service waiting tickets", () => {
  assert.match(reconciler, /\.eq\("status", "waiting_customer"\)/);
  assert.match(reconciler, /\.limit\(50\)/);
  assert.doesNotMatch(reconciler, /\.select\([^)]*message/);
  assert.doesNotMatch(reconciler, /\.select\([^)]*subject/);
});

test("ticket update is compare-and-set so manual support work cannot be overwritten", () => {
  const updates = reconciler.match(/\.eq\("status", "waiting_customer"\)/g) || [];
  assert.ok(updates.length >= 2);
  assert.match(reconciler, /\.eq\("id", ticket\.id\)/);
});

test("dedicated authenticated support cron runs the autonomous operations agent", () => {
  const auth = cron.indexOf("authorization !== ");
  const support = cron.indexOf("runSupportOperationsAgentFromEnvironment()");
  assert.ok(auth >= 0);
  assert.ok(support > auth);
  assert.match(cron, /result\.ok/);
});
