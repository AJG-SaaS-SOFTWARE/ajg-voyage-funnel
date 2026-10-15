import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const code = ts.transpileModule(fs.readFileSync(new URL("../app/api/run/support-sync/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const id = "10000000-0000-4000-8000-000000000001";

function harness(initial = "diagnosed", writeError = false) {
  const row = { id, status: initial, resolution_code: initial === "resolved" ? "original-proof" : null, resolved_at: initial === "resolved" ? "2026-10-15T00:00:00Z" : null };
  const stats = { writes: 0, events: [], clients: 0 };
  const service = { from(table) {
    assert.equal(table, "support_tickets");
    const filters = {}; let excluded = [], patch;
    const query = {
      update(value) { patch = value; return query; }, eq(key, value) { filters[key] = value; return query; },
      not(key, operator, values) { assert.equal(key, "status"); assert.equal(operator, "in"); excluded = JSON.parse(`[${values.slice(1, -1)}]`); return query; },
      select() { return query; },
      async maybeSingle() {
        if (writeError) return { data: null, error: { code: "synthetic-write-error" } };
        if (excluded.includes(row.status) || !Object.entries(filters).every(([key, value]) => row[key] === value)) return { data: null, error: null };
        stats.writes++; Object.assign(row, patch); return { data: { id, status: row.status }, error: null };
      }
    };
    return query;
  } };
  const deps = {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@supabase/supabase-js": { createClient: () => { stats.clients++; return service; } },
    "../../../../lib/support-events": { recordSupportEvent: async (_service, event) => { stats.events.push(event); return true; } }
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", "process", code)(name => { assert.ok(name in deps); return deps[name]; }, module, module.exports, { env: { AJG_RUN_TOKEN: "synthetic-token", NEXT_PUBLIC_SUPABASE_URL: "https://synthetic.invalid", SUPABASE_SECRET_KEY: "synthetic-key" } });
  return { row, stats, sync: (status, token = "synthetic-token") => module.exports.POST(new Request("https://synthetic.invalid/api/run/support-sync", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ externalRef: `builder-ticket:${id}`, status }) })) };
}

test("delayed in-progress delivery cannot reopen resolved or closed tickets", async () => {
  for (const status of ["resolved", "closed"]) {
    const app = harness(status), before = structuredClone(app.row);
    const response = await app.sync("in_progress");
    assert.equal(response.status, 200);
    assert.equal((await response.json()).changed, false);
    assert.deepEqual(app.row, before);
    assert.equal(app.stats.writes, 0);
    assert.deepEqual(app.stats.events, []);
  }
});

test("repeated progress and resolution deliveries change and audit each transition once", async () => {
  const app = harness();
  for (const status of ["in_progress", "in_progress", "resolved", "resolved", "in_progress"]) assert.equal((await app.sync(status)).status, 200);
  assert.equal(app.row.status, "resolved");
  assert.equal(app.stats.writes, 2);
  assert.deepEqual(app.stats.events.map(x => x.type), ["diagnostic", "resolution"]);
});

test("simultaneous duplicate deliveries converge without duplicate events", async () => {
  const app = harness();
  await Promise.all([app.sync("resolved"), app.sync("resolved")]);
  assert.equal(app.row.status, "resolved");
  assert.equal(app.stats.writes, 1);
  assert.equal(app.stats.events.length, 1);
});

test("write failures return unavailable without auditing a transition", async () => {
  const app = harness("diagnosed", true);
  assert.equal((await app.sync("resolved")).status, 503);
  assert.equal(app.row.status, "diagnosed");
  assert.deepEqual(app.stats.events, []);
});

test("unauthorized delivery cannot instantiate a privileged client", async () => {
  const app = harness();
  assert.equal((await app.sync("resolved", "invalid")).status, 401);
  assert.equal(app.stats.clients, 0);
  assert.deepEqual(app.stats.events, []);
});
