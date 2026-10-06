import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(
  new URL("../docs/migrations/20261006193639_index_remaining_foreign_keys.sql", import.meta.url),
  "utf8"
);

test("remaining Supabase foreign keys have explicit covering indexes", () => {
  const expected = [
    "ai_request_admissions_site_id_idx",
    "site_ai_heavy_usage_site_id_idx",
    "site_ai_launch_entitlements_owner_id_idx",
    "site_ai_launch_operations_entitlement_id_idx",
    "site_ai_launch_operations_owner_id_idx",
    "support_remediation_runs_ticket_id_idx"
  ];

  for (const name of expected) {
    assert.ok(migration.includes(`create index if not exists ${name}`));
  }

  assert.match(migration, /ai_request_admissions\(site_id\)/);
  assert.match(migration, /site_ai_heavy_usage\(site_id\)/);
  assert.match(migration, /site_ai_launch_entitlements\(owner_id\)/);
  assert.match(migration, /site_ai_launch_operations\(entitlement_id\)/);
  assert.match(migration, /site_ai_launch_operations\(owner_id\)/);
  assert.match(migration, /support_remediation_runs\(ticket_id\)/);
});
