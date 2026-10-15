import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../app/api/support/tickets/route.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function harness({ concurrent = false, foreign = false, writeError = false } = {}) {
  const row = { id: "synthetic-ticket", user_id: foreign ? "owner-b" : "owner-a", site_id: "synthetic-site", category: "domain", status: "waiting_customer", diagnosis: {}, created_at: "2026-10-14T00:00:00Z", updated_at: "2026-10-14T01:00:00Z" };
  const stats = { diagnoses: 0, updates: 0, events: [] };
  const service = { from(table) {
    assert.equal(table, "support_tickets");
    const filters = {};
    let patch;
    const query = {
      select() { return query; }, eq(key, value) { filters[key] = value; return query; },
      update(value) { patch = value; return query; },
      async maybeSingle() {
        if (patch) stats.updates++;
        if (patch && writeError) return { data: null, error: { code: "SYNTHETIC_WRITE_FAILURE" } };
        if (!Object.entries(filters).every(([key, value]) => row[key] === value)) return { data: null, error: null };
        if (patch) Object.assign(row, patch);
        return { data: structuredClone(row), error: null };
      }
    };
    return query;
  } };
  const dependencies = {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@supabase/supabase-js": { createClient: (_url, key) => key === "synthetic-service" ? service : { auth: { getUser: async () => ({ data: { user: { id: "owner-a" } }, error: null }) } } },
    "../../../../lib/support-health-server": { diagnoseSupportHealth: async (_service, userId, siteId) => {
      assert.equal(userId, "owner-a"); assert.equal(siteId, "synthetic-site"); stats.diagnoses++;
      // Another worker changes the ticket while retaining waiting_customer.
      if (concurrent) Object.assign(row, { updated_at: "2026-10-14T02:00:00Z", resolution_code: "newer-worker-evidence" });
      return { siteId, diagnosis: { overall: "healthy", checks: [] } };
    } },
    "../../../../lib/support-reconcile-policy": { supportCustomerAction: () => null, supportReconcileDecision: () => ({ status: "resolved", resolved: true, resolutionCode: "synthetic-verified" }) },
    "../../../../lib/support-events": { recordSupportEvent: async (_service, event) => stats.events.push(event) },
    "../../../../lib/run-intake-reporting": {},
    "../../../../lib/server-locale": { requestProductLocale: () => "en", localize: (_locale, _fr, en) => en }
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", "process", code)(name => {
    assert.ok(name in dependencies); return dependencies[name];
  }, module, module.exports, { env: { NEXT_PUBLIC_SUPABASE_URL: "https://synthetic.invalid", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic-public", SUPABASE_SECRET_KEY: "synthetic-service" } });
  return { row, stats, patch: () => module.exports.PATCH(new Request("https://synthetic.invalid/api/support/tickets", { method: "PATCH", headers: { Authorization: "Bearer synthetic-token", "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id }) })) };
}

test("customer rediagnosis rejects stale same-status evidence without overwriting or emitting resolution", async () => {
  const app = harness({ concurrent: true });
  const response = await app.patch();
  assert.equal(response.status, 409);
  assert.equal(app.row.status, "waiting_customer");
  assert.equal(app.row.resolution_code, "newer-worker-evidence");
  assert.equal(app.row.updated_at, "2026-10-14T02:00:00Z");
  assert.deepEqual(app.stats.events, []);
});

test("unchanged owned ticket is updated and audited after diagnosis", async () => {
  const app = harness();
  const response = await app.patch();
  assert.equal(response.status, 200);
  assert.equal(app.row.status, "resolved");
  assert.equal(app.stats.events.length, 1);
  assert.equal(app.stats.events[0].type, "resolution");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("foreign ticket is rejected before diagnosis or writes", async () => {
  const app = harness({ foreign: true });
  assert.equal((await app.patch()).status, 404);
  assert.equal(app.stats.diagnoses, 0);
  assert.equal(app.stats.updates, 0);
  assert.deepEqual(app.stats.events, []);
});

test("failed update cannot announce or audit a resolution", async () => {
  const app = harness({ writeError: true });
  assert.equal((await app.patch()).status, 503);
  assert.equal(app.row.status, "waiting_customer");
  assert.deepEqual(app.stats.events, []);
});
