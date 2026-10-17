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
  assert.match(reconciler, /service\.rpc\(/);
  assert.match(reconciler, /"reconcile_support_ticket_atomic"/);
  assert.match(reconciler, /p_expected_updated_at: ticket\.updated_at/);
  assert.match(reconciler, /p_user_id: ticket\.user_id/);
  const migration = fs.readFileSync(new URL("../supabase/migrations/20261017161315_support_reconcile_atomic_audit.sql", import.meta.url), "utf8");
  assert.match(migration, /status = 'waiting_customer' and updated_at = p_expected_updated_at/);
  assert.match(migration, /security invoker set search_path = ''/);
  assert.match(migration, /from public, anon, authenticated/);
  assert.match(migration, /to service_role/);
  assert.doesNotMatch(migration, /exception when/i); // No swallowed audit failure.

});

test("dedicated authenticated support cron runs the autonomous operations agent", () => {
  const auth = cron.indexOf("authorization !== ");
  const support = cron.indexOf("runSupportOperationsAgentFromEnvironment()");
  assert.ok(auth >= 0);
  assert.ok(support > auth);
  assert.match(cron, /result\.ok/);
});
