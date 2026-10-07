import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(
  new URL("../app/api/admin/builder-e2e/route.ts", import.meta.url),
  "utf8"
);
const readiness = fs.readFileSync(
  new URL("../app/api/admin/release-readiness/route.ts", import.meta.url),
  "utf8"
);
const migration = fs.readFileSync(
  new URL("../supabase/migrations/20261007104500_builder_e2e_run_journal.sql", import.meta.url),
  "utf8"
);

test("Builder E2E journal is service-role only and stores no customer content", () => {
  assert.match(migration, /create table if not exists public\.builder_e2e_runs/);
  assert.match(migration, /alter table public\.builder_e2e_runs enable row level security/);
  assert.match(migration, /revoke all on public\.builder_e2e_runs from anon, authenticated/);
  assert.match(migration, /grant select, insert, update, delete on public\.builder_e2e_runs to service_role/);
  assert.doesNotMatch(migration, /email|site_id|owner_id|message|subject/i);
});

test("every authenticated E2E run is bound to the deployed SHA before execution", () => {
  assert.match(route, /process\.env\.AJG_RELEASE_SHA \|\|/);
  assert.match(route, /process\.env\.VERCEL_GIT_COMMIT_SHA/);
  assert.match(route, /\.from\("builder_e2e_runs"\)/);
  assert.match(route, /deployment_sha: deploymentSha/);
  assert.match(route, /include_ai: includeAi/);
  assert.match(route, /status: "running"/);
  assert.match(route, /E2E validation journal unavailable/);
});

test("E2E completion records success failure and cleanup failure durably", () => {
  assert.match(route, /finishJournal\("success", null, null\)/);
  assert.match(route, /cleanupOk \? "failed" : "cleanup_failed"/);
  assert.match(route, /finishJournal\(\s*"cleanup_failed",\s*"cleanup"/);
  assert.match(route, /failure_stage: stage/);
  assert.match(route, /completed_at: new Date\(\)\.toISOString\(\)/);
  assert.match(route, /steps\s*\n\s*}\)\s*\n\s*\.eq\("id", journalRunId\)/);
});

test("release readiness only accepts mirrored AI E2E success for the current SHA", () => {
  assert.match(readiness, /\.from\("builder_e2e_runs"\)/);
  assert.match(readiness, /\.eq\("deployment_sha", deploymentSha!\)/);
  assert.match(readiness, /\.eq\("include_ai", true\)/);
  assert.match(readiness, /\.select\("status,completed_at"\)/);
  assert.match(readiness, /\(\["fr", "en"\] as const\)/);
  assert.match(readiness, /releaseE2ERunDecision\(rows\)/);
  assert.match(readiness, /key: "builder-e2e-mirror"/);
  assert.match(readiness, /mirrorValidated[\s\S]*"pass"/);
});

test("release readiness escalates an exhausted autonomous E2E budget", () => {
  assert.match(readiness, /retryBudgetExhausted/);
  assert.match(readiness, /retry_budget_exhausted/);
  assert.match(readiness, /"blocker"/);
  assert.match(readiness, /bloqué après 3 échecs/);
  assert.match(readiness, /Impossible de lire le journal E2E Builder/);
});


test("release readiness defers mirrored AI E2E while OpenAI itself is blocked", () => {
  assert.match(readiness, /openAiAudit\.status === "blocker"/);
  assert.match(readiness, /\? "deferred"/);
  assert.match(readiness, /E2E IA différé/);
  assert.match(readiness, /budget de retries E2E n’est pas consommé/);
});
