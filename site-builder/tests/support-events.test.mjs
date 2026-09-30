import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(
  new URL("../supabase/migrations/20261001002000_support_ticket_events.sql", import.meta.url),
  "utf8"
);
const helper = fs.readFileSync(
  new URL("../lib/support-events.ts", import.meta.url),
  "utf8"
);
const clientRoute = fs.readFileSync(
  new URL("../app/api/support/tickets/route.ts", import.meta.url),
  "utf8"
);
const adminRoute = fs.readFileSync(
  new URL("../app/api/admin/support/route.ts", import.meta.url),
  "utf8"
);
const reconcile = fs.readFileSync(
  new URL("../lib/support-reconcile.ts", import.meta.url),
  "utf8"
);

test("support audit trail stays server-write-only", () => {
  assert.match(migration, /revoke insert, update, delete on public\.support_ticket_events from authenticated/i);
  assert.match(migration, /grant select on public\.support_ticket_events to authenticated/i);
  assert.match(migration, /users read own support ticket events/i);
});

test("support events only accept bounded primitive metadata", () => {
  assert.match(helper, /safeMetadata/);
  assert.match(helper, /slice\(0, 12\)/);
  assert.match(helper, /slice\(0, 2000\)/);
  assert.ok(!helper.includes("subject"));
  assert.ok(!helper.includes("ticket.message"));
});

test("client lifecycle records creation and re-diagnosis without copying ticket body", () => {
  assert.match(clientRoute, /recordSupportEvent/);
  assert.match(clientRoute, /type: "created"/);
  assert.match(clientRoute, /type: decision\.resolved \? "resolution" : "diagnostic"/);
});

test("admin and autonomous reconciliation emit lifecycle events", () => {
  assert.match(adminRoute, /actor: "admin"/);
  assert.match(reconcile, /actor: "system"/);
  assert.match(reconcile, /decision\.status/);
});
