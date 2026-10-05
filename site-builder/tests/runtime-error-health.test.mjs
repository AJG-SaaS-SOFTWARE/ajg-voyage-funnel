import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const instrumentation = fs.readFileSync(new URL("../instrumentation.ts", import.meta.url), "utf8");
const helper = fs.readFileSync(new URL("../lib/runtime-error-health.ts", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../supabase/migrations/20261005202000_runtime_error_health.sql", import.meta.url), "utf8");

test("Next server error hook records privacy-minimized telemetry", () => {
  assert.match(instrumentation, /onRequestError/);
  assert.match(instrumentation, /recordNextRuntimeError/);
  assert.match(helper, /runtime_error_events/);
  assert.match(helper, /route_path/);
  assert.match(helper, /route_type/);
  assert.match(helper, /error_code/);
  assert.doesNotMatch(helper, /error\.message/);
  assert.doesNotMatch(helper, /error\.stack/);
});

test("runtime error ledger is service-role only and retained for 30 days", () => {
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.runtime_error_events from public,anon,authenticated/);
  assert.match(migration, /grant select,insert,delete on table public\.runtime_error_events to service_role/);
  assert.match(migration, /interval '30 days'/);
  assert.match(migration, /eltara-runtime-errors-prune/);
});

test("runtime telemetry resolves site scope from hostname or published slug without storing request content", () => {
  assert.match(helper, /from\("domains"\)/);
  assert.match(helper, /from\("sites"\)/);
  assert.match(helper, /request\.path\.split\("\?"\)/);
  assert.doesNotMatch(migration, /request_body|query_string|stack_trace|message text/i);
});
