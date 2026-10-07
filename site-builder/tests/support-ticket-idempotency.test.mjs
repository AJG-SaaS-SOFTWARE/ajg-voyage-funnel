import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const id = "10000000-0000-4000-8000-000000000001";
const draft = { requestId: id, category: "bug", subject: "Synthetic subject", message: "Synthetic isolated ticket description" };
const health = { siteId: null, diagnosis: { overall: "healthy", checks: [], clientAction: null } };
const fixture = (overrides = {}) => ({ ...draft, id, user_id: "owner-a", site_id: null,
  status: "diagnosed", severity: "normal", diagnosis: health.diagnosis, ...overrides });
const source = fs.readFileSync(new URL("../app/api/support/tickets/route.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022
} }).outputText;

function harness({ rows = [], recent = 0, open = 0, lookupFails = false,
  insertFailure = false, loseInsertResponse = false, auditThrows = false } = {}) {
  const database = new Map(rows.map((row) => [row.id, structuredClone(row)]));
  const stats = { inserts: [], lookups: [], counts: 0, diagnoses: 0, events: [], reports: [] };
  const service = { from(table) {
    assert.equal(table, "support_tickets");
    const filters = {};
    let inserted, counting = false;
    const query = {
      select(_columns, options) { counting = Boolean(options?.count); return query; },
      eq(key, value) { filters[key] = value; return query; },
      gte(key, value) { filters[key] = value; return query; },
      not(key, _operator, value) { filters[key] = value; return query; },
      insert(value) { inserted = value; return query; },
      async maybeSingle() {
        stats.lookups.push({ ...filters });
        if (lookupFails) return { data: null, error: { code: "SYNTHETIC_READ_FAILURE" } };
        const row = database.get(filters.id);
        return { data: row?.user_id === filters.user_id ? structuredClone(row) : null, error: null };
      },
      async single() {
        stats.inserts.push(structuredClone(inserted));
        if (insertFailure) return { data: null, error: { code: "SYNTHETIC_WRITE_FAILURE" } };
        const rowId = inserted.id || `legacy-${stats.inserts.length}`;
        if (database.has(rowId)) return { data: null, error: { code: "23505" } };
        const row = { ...inserted, id: rowId };
        database.set(rowId, row);
        if (loseInsertResponse) return { data: null, error: { code: "SYNTHETIC_LOST_RESPONSE" } };
        return { data: structuredClone(row), error: null };
      },
      then(resolve, reject) {
        assert.equal(counting, true);
        assert.equal(filters.user_id, "owner-a");
        stats.counts++;
        return Promise.resolve({ count: filters.created_at ? recent : open, error: null }).then(resolve, reject);
      }
    };
    return query;
  } };
  const dependencies = {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@supabase/supabase-js": { createClient: (_url, key) => key === "synthetic-service"
      ? service : { auth: { getUser: async (token) => ({ data: { user: token === "valid-token" ? { id: "owner-a" } : null }, error: null }) } } },
    "../../../../lib/support-health-server": { diagnoseSupportHealth: async () => { stats.diagnoses++; return structuredClone(health); } },
    "../../../../lib/support-reconcile-policy": { supportReconcileDecision() { throw new Error("Unexpected PATCH"); } },
    "../../../../lib/support-events": { recordSupportEvent: async (_service, event) => { stats.events.push(event); if (auditThrows) throw new Error("Synthetic audit crash"); } },
    "../../../../lib/run-intake-reporting": { reportSupportTicketToRun: async (report) => { stats.reports.push(report); return { ok: true }; } },
    "../../../../lib/server-locale": {
      requestProductLocale: () => "fr",
      localize: (locale, fr, en) => locale === "en" ? en : fr
    }
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", "process", code)(
    (name) => { assert.ok(name in dependencies, `Unexpected import ${name}`); return dependencies[name]; },
    module, module.exports, { env: { NEXT_PUBLIC_SUPABASE_URL: "https://synthetic.invalid", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic-public", SUPABASE_SECRET_KEY: "synthetic-service" } }
  );
  return { database, stats, post: (body = draft, token = "valid-token") => module.exports.POST(new Request("https://synthetic.invalid/api/support/tickets", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body)
  })) };
}

test("same identity replay returns the ticket without diagnostics, quota checks or downstream effects", async () => {
  const app = harness({ rows: [fixture({ status: "resolved" })], recent: 3, open: 25 });
  const reply = await app.post();
  assert.equal(reply.status, 201);
  const body = await reply.json();
  assert.equal(body.replayed, true);
  assert.equal(body.ticket.status, "resolved");
  assert.equal(reply.headers.get("cache-control"), "private, no-store");
  assert.equal(app.stats.inserts.length, 0);
  assert.equal(app.stats.counts, 0);
  assert.equal(app.stats.diagnoses, 0);
  assert.deepEqual(app.stats.events, []);
  assert.deepEqual(app.stats.reports, []);
});

test("two concurrent real POST handlers converge on one primary-key ticket", async () => {
  const app = harness();
  const replies = await Promise.all([app.post(), app.post()]);
  assert.deepEqual(replies.map((reply) => reply.status), [201, 201]);
  const bodies = await Promise.all(replies.map((reply) => reply.json()));
  assert.deepEqual(bodies.map((body) => body.ticket.id), [id, id]);
  assert.equal(bodies.filter((body) => body.replayed).length, 1);
  assert.equal(app.database.size, 1);
  assert.equal(app.stats.inserts.length, 2);
  assert.equal(app.stats.events.length, 1);
  assert.equal(app.stats.reports.length, 1);
  assert.ok(app.stats.lookups.every((lookup) => lookup.id === id && lookup.user_id === "owner-a"));
});

test("same identity with changed content is rejected and cannot overwrite a resolved ticket", async () => {
  const app = harness({ rows: [fixture({ status: "resolved" })] });
  assert.equal((await app.post({ ...draft, message: "Different synthetic description" })).status, 409);
  assert.equal(app.database.get(id).status, "resolved");
  assert.equal(app.database.get(id).message, draft.message);
  assert.equal(app.stats.inserts.length, 0);
  assert.equal(app.stats.diagnoses, 0);
});

test("same identity with a different explicitly requested site is rejected", async () => {
  const app = harness({ rows: [fixture({ site_id: "original-synthetic-site" })] });
  assert.equal((await app.post({ ...draft, siteId: "different-synthetic-site" })).status, 409);
  assert.equal(app.stats.inserts.length, 0);
});

test("a foreign owner's colliding ID never exposes or overwrites their ticket", async () => {
  const app = harness({ rows: [fixture({ user_id: "owner-b", subject: "Private synthetic subject" })] });
  const reply = await app.post();
  assert.equal(reply.status, 503);
  assert.doesNotMatch(await reply.text(), /Private synthetic subject|owner-b/);
  assert.equal(app.database.size, 1);
  assert.equal(app.database.get(id).user_id, "owner-b");
  assert.ok(app.stats.lookups.every((lookup) => lookup.user_id === "owner-a"));
  assert.equal(app.stats.events.length, 0);
  assert.equal(app.stats.reports.length, 0);
});

test("failed lookup is not treated as absence and performs no insert", async () => {
  const app = harness({ lookupFails: true });
  assert.equal((await app.post()).status, 503);
  assert.equal(app.stats.inserts.length, 0);
  assert.equal(app.stats.counts, 0);
});

test("lost insert response is reconciled by ID without replaying audit or Run reporting", async () => {
  const app = harness({ loseInsertResponse: true });
  const reply = await app.post();
  assert.equal(reply.status, 201);
  assert.equal((await reply.json()).replayed, true);
  assert.equal(app.database.size, 1);
  assert.equal(app.stats.inserts[0].id, id);
  // Persistence is confirmed; downstream delivery is deliberately NOT claimed.
  assert.equal(app.stats.events.length, 0);
  assert.equal(app.stats.reports.length, 0);
});

test("failed insert with no positive read remains unconfirmed and uses no replacement ID", async () => {
  const app = harness({ insertFailure: true });
  assert.equal((await app.post()).status, 503);
  assert.equal(app.database.size, 0);
  assert.deepEqual(app.stats.inserts.map((row) => row.id), [id]);
  assert.equal(app.stats.lookups.length, 2);
});

test("replay after an audit crash returns the persisted ticket without repairing history by replay", async () => {
  const app = harness({ auditThrows: true });
  await assert.rejects(app.post(), /Synthetic audit crash/);
  assert.equal((await app.post()).status, 201);
  assert.equal(app.database.size, 1);
  assert.equal(app.stats.events.length, 1);
  assert.equal(app.stats.reports.length, 0);
});

test("invalid or non-v4 request identities fail before any ticket lookup", async () => {
  for (const requestId of [null, 12, "invalid", "00000000-0000-1000-8000-000000000001"]) {
    const app = harness();
    assert.equal((await app.post({ ...draft, requestId })).status, 400);
    assert.equal(app.stats.lookups.length, 0);
    assert.equal(app.stats.inserts.length, 0);
  }
});

test("unauthenticated requests cannot look up idempotent tickets", async () => {
  const app = harness({ rows: [fixture()] });
  assert.equal((await app.post(draft, "expired-token")).status, 401);
  assert.equal(app.stats.lookups.length, 0);
});

test("legacy clients remain supported and new identities still obey quotas", async () => {
  const app = harness();
  const { requestId: _unused, ...legacy } = draft;
  assert.equal((await app.post(legacy)).status, 201);
  assert.equal(app.stats.lookups.length, 0);
  assert.equal(app.stats.inserts[0].id, undefined);
  const blocked = harness({ recent: 3 });
  assert.equal((await blocked.post()).status, 429);
  assert.equal(blocked.stats.inserts.length, 0);
});
