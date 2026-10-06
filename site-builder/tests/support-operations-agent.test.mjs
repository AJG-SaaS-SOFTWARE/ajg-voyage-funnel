import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const agent = fs.readFileSync(new URL("../lib/support-operations-agent.ts", import.meta.url), "utf8");
const reporter = fs.readFileSync(new URL("../lib/run-intake-reporting.ts", import.meta.url), "utf8");
const adminRoute = fs.readFileSync(new URL("../app/api/admin/support-operations/route.ts", import.meta.url), "utf8");
const cron = fs.readFileSync(new URL("../app/api/cron/support-operations/route.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/admin/support/page.tsx", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../supabase/migrations/20261006180500_support_operations_runs.sql", import.meta.url), "utf8");
const vercel = fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8");

test("support operations journal is service-only and RLS protected", () => {
  assert.match(migration, /create table if not exists public\.support_operations_runs/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on public\.support_operations_runs from anon, authenticated/);
  assert.match(migration, /grant select, insert, update, delete on public\.support_operations_runs to service_role/);
});

test("support agent composes reconciliation, safe remediation and bounded runtime health", () => {
  assert.match(agent, /runSupportReconciliationSafely/);
  assert.match(agent, /runSupportRemediationSweepSafely/);
  assert.match(agent, /getRecentRuntimeHealth/);
  assert.match(agent, /from\("support_operations_runs"\)/);
  assert.match(agent, /status: "running"/);
  assert.match(agent, /runtime\.status === "incident"/);
});

test("runtime incident reporting is structured and contains no support message body", () => {
  assert.match(reporter, /reportRuntimeIncidentToRun/);
  assert.match(reporter, /builder-runtime:/);
  assert.match(reporter, /kind: "incident"/);
  assert.match(reporter, /errorCount/);
  assert.match(reporter, /http5xxCount/);
  assert.doesNotMatch(reporter, /input\.message/);
});

test("support operations endpoints are protected and scheduled hourly", () => {
  assert.match(cron, /CRON_SECRET/);
  assert.match(cron, /authorization/);
  assert.match(adminRoute, /role\?\.role !== "admin"/);
  assert.match(vercel, /\/api\/cron\/support-operations/);
  assert.match(vercel, /20 \* \* \* \*/);
});

test("admin support surfaces run agent health and explicit manual execution", () => {
  assert.match(page, /RUN autonome/);
  assert.match(page, /Agent Support opérationnel/);
  assert.match(page, /Exécuter maintenant/);
  assert.match(page, /reported_to_run/);
  assert.match(page, /runtime production/);
});
