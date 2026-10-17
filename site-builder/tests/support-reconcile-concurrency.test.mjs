import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { supportScanWindow } from "../lib/support-scan-window.ts";
const code = ts.transpileModule(fs.readFileSync(new URL("../lib/support-reconcile.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function harness({ concurrent = false, auditOk = true, writeError = false } = {}) {
  const rows = [0, 1].map(i => ({ id: `ticket-${i}`, user_id: `user-${i}`, site_id: `site-${i}`, category: "domain", status: "waiting_customer", diagnosis: {}, created_at: "2026-10-14T00:00:00Z", updated_at: "2026-10-14T01:00:00Z" }));
  const stats = { events: [], writes: [] };
  const service = { async rpc(name, input) {
    assert.equal(name, "reconcile_support_ticket_atomic");
    if (writeError || !auditOk) return { data: null, error: { code: "synthetic-transaction-failure" } };
    const row = rows.find(r => r.id === input.p_ticket_id && r.user_id === input.p_user_id &&
      r.status === "waiting_customer" && r.updated_at === input.p_expected_updated_at);
    if (!row) return { data: false, error: null };
    stats.writes.push(row.id);
    Object.assign(row, { status: input.p_status, diagnosis: input.p_diagnosis });
    stats.events.push({ ticketId: row.id });
    return { data: true, error: null };
  }, from(table) {
    assert.equal(table, "support_tickets");
    const filters = {}; let counting = false, patch;
    const query = {
      select(_columns, options) { counting = Boolean(options?.head); return query; },
      eq(key, value) { filters[key] = value; return query; }, order() { return query; }, limit() { return query; }, range() { return query; },
      update(value) { patch = value; return query; },
      async maybeSingle() {
        if (writeError) return { data: null, error: { code: "synthetic-write-failure" } };
        const row = rows.find(r => Object.entries(filters).every(([key, value]) => r[key] === value));
        if (!row) return { data: null, error: null };
        stats.writes.push(row.id); Object.assign(row, patch); return { data: { id: row.id }, error: null };
      },
      then(resolve, reject) { return Promise.resolve(counting ? { count: rows.length, error: null } : { data: structuredClone(rows), error: null }).then(resolve, reject); }
    };
    return query;
  } };
  const deps = {
    "@supabase/supabase-js": {}, "./support-scan-window": { supportScanWindow },
    "./support-health-server": { diagnoseSupportHealth: async (_service, userId) => {
      if (concurrent && userId === "user-0") Object.assign(rows[0], { updated_at: "2026-10-15T01:00:00Z", diagnosis: { newer: true } });
      return { diagnosis: { overall: "healthy", checks: [] } };
    } },
    "./support-reconcile-policy": { supportCustomerAction: () => null, supportReconcileDecision: () => ({ status: "resolved", resolved: true, resolutionCode: "synthetic-proof" }) },
    "./support-events": { recordSupportEvent: async (_service, event) => { stats.events.push(event); return auditOk; } }
  };
  deps["./support-health-server"].createSupportHealthDiagnoser = service => (...args) => deps["./support-health-server"].diagnoseSupportHealth(service, ...args);
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(name => { assert.ok(name in deps); return deps[name]; }, module, module.exports);
  return { rows, stats, run: () => module.exports.runSupportReconciliationSafely(new Date("2026-10-15T02:00:00Z"), service) };
}

test("automatic reconciliation preserves newer same-status evidence and continues independent tickets", async () => {
  const app = harness({ concurrent: true });
  const result = await app.run();
  assert.equal(result.ok, true);
  assert.equal(result.scanned, 2);
  assert.equal(result.resolved, 1);
  assert.equal(app.rows[0].status, "waiting_customer");
  assert.deepEqual(app.rows[0].diagnosis, { newer: true });
  assert.equal(app.rows[1].status, "resolved");
  assert.deepEqual(app.stats.writes, ["ticket-1"]);
  assert.deepEqual(app.stats.events.map(x => x.ticketId), ["ticket-1"]);
});

test("unchanged tickets reconcile and audit normally", async () => {
  const app = harness();
  const result = await app.run();
  assert.equal(result.ok, true);
  assert.equal(result.resolved, 2);
  assert.equal(app.stats.events.length, 2);
});

test("unconfirmed audit prevents a successful reconciliation result", async () => {
  const app = harness({ auditOk: false });
  const result = await app.run();
  assert.equal(result.ok, false);
  assert.equal(result.resolved, 0);
  assert.equal(result.failed, 2);
  assert.ok(app.rows.every(x => x.status === "waiting_customer"));
  assert.deepEqual(app.stats.events, []);
});

test("write failures preserve tickets and create no resolution event", async () => {
  const app = harness({ writeError: true });
  const result = await app.run();
  assert.equal(result.ok, false);
  assert.equal(result.failed, 2);
  assert.ok(app.rows.every(x => x.status === "waiting_customer"));
  assert.deepEqual(app.stats.events, []);
});
