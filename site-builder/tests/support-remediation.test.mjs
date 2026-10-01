import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(
  new URL("../supabase/migrations/20261001084500_support_auto_remediation.sql", import.meta.url),
  "utf8"
);
const remediation = fs.readFileSync(
  new URL("../lib/support-remediation.ts", import.meta.url),
  "utf8"
);
const route = fs.readFileSync(
  new URL("../app/api/support/remediate/route.ts", import.meta.url),
  "utf8"
);

test("remediation audit is server-write-only and owner-readable", () => {
  assert.match(migration, /revoke insert, update, delete on public\.support_remediation_runs from authenticated/i);
  assert.match(migration, /grant select on public\.support_remediation_runs to authenticated/i);
  assert.match(migration, /user_id=\(select auth\.uid\(\)\)/i);
});

test("managed domain repair is scoped to an owned published active site", () => {
  assert.match(remediation, /\.eq\("owner_id", input\.userId\)/);
  assert.match(remediation, /site\.privacy_state !== "active"/);
  assert.match(remediation, /site\.status !== "published"/);
});

test("managed domain repair never rewrites a mismatched hostname", () => {
  assert.match(remediation, /managed\.hostname !== expectedHostname/);
  assert.match(remediation, /managed_domain_hostname_mismatch/);
  assert.ok(!remediation.includes('.update({ hostname: expectedHostname'));
});

test("managed domain repair preserves a verified custom domain as primary", () => {
  assert.match(remediation, /kind", "custom_domain"/);
  assert.match(remediation, /verification_status", "verified"/);
  assert.match(remediation, /is_primary: !verifiedCustom/);
});

test("repair endpoint authenticates, rate-limits and does not accept arbitrary actions", () => {
  assert.match(route, /auth\.getUser\(token\)/);
  assert.match(route, /new Set<SupportRepairAction>\(\["managed_domain_repair"\]\)/);
  assert.match(route, /support_remediation_runs/);
  assert.match(route, /status: 429/);
});


const diagnostics = fs.readFileSync(
  new URL("../lib/support-diagnostics.ts", import.meta.url),
  "utf8"
);
const page = fs.readFileSync(
  new URL("../app/support/page.tsx", import.meta.url),
  "utf8"
);

test("Health Center only advertises the allowlisted managed-domain repair", () => {
  assert.match(diagnostics, /repairActions: SupportRepairAction\[\]/);
  assert.match(diagnostics, /repairActions\.push\("managed_domain_repair"\)/);
  assert.match(page, /Corriger automatiquement/);
  assert.match(page, /\/api\/support\/remediate/);
});

test("custom-domain DNS issues remain a customer action and are not auto-mutated", () => {
  assert.match(diagnostics, /const custom = input\.domains\.find/);
  assert.match(diagnostics, /contrôlez les enregistrements DNS demandés/);
  assert.ok(!remediation.includes('kind: "custom_domain"'));
});
