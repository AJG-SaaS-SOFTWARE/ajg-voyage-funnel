import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const bootstrap = fs.readFileSync(new URL("../lib/storage-bootstrap.ts", import.meta.url), "utf8");
const healing = fs.readFileSync(new URL("../lib/platform-self-healing.ts", import.meta.url), "utf8");
const agent = fs.readFileSync(new URL("../lib/support-operations-agent.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/admin/support/page.tsx", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../supabase/migrations/20261006183000_support_platform_self_healing.sql", import.meta.url), "utf8");

test("private storage self-heal is idempotent and verifies privacy", () => {
  assert.match(bootstrap, /getBucket\(PRIVATE_BUCKET\)/);
  assert.match(bootstrap, /createBucket\(PRIVATE_BUCKET/);
  assert.match(bootstrap, /updateBucket\(PRIVATE_BUCKET/);
  assert.match(bootstrap, /public: false/);
  assert.match(bootstrap, /verified\.public === false/);
});

test("platform self-healing only refreshes backup when freshness is degraded", () => {
  assert.match(healing, /before\.status === "warning"/);
  assert.match(healing, /before\.status === "critical"/);
  assert.match(healing, /runStorageBackup\(\)/);
  assert.match(healing, /after\.status === "healthy"/);
  assert.match(healing, /backup_refreshed_and_verified/);
});

test("platform repair runs before ticket reconciliation", () => {
  const heal = agent.indexOf("runPlatformSelfHealing(service)");
  const reconcile = agent.indexOf("runSupportReconciliationSafely(now)");
  assert.ok(heal >= 0);
  assert.ok(reconcile > heal);
  assert.match(agent, /platform_status: platform\.status/);
  assert.match(agent, /platform_actions: platform\.actions/);
});

test("operations journal records platform remediation state", () => {
  assert.match(migration, /platform_status/);
  assert.match(migration, /platform_repaired/);
  assert.match(migration, /platform_failed/);
  assert.match(migration, /platform_actions jsonb/);
  assert.match(migration, /backup_status_after/);
});

test("admin surfaces autonomous platform repairs", () => {
  assert.match(page, /auto-réparation plateforme/);
  assert.match(page, /Corrections autonomes/);
  assert.match(page, /Storage privé restauré/);
  assert.match(page, /sauvegarde rafraîchie/);
});
