import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const code = ts.transpileModule(fs.readFileSync(new URL("../app/api/run/support-sync/route.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const ticketId = "10000000-0000-4000-8000-000000000001", requestId = "req_1234abcd";
const stamp = "2026-10-18T16:00:00+00:00", resolution = "auto_verified_managed_primary_repair";
function harness(options = {}) {
  const stats = { clients: 0, reads: 0, filters: [] };
  const ticket = { id: ticketId, status: "resolved", resolved_at: stamp, resolution_code: resolution, updated_at: stamp, ...options.ticket };
  const events = [{ id: 41, ticket_id: ticketId, event_type: "diagnostic", actor_type: "system", metadata: { source: "ajg-run-intake", request_id: requestId } },
    { id: 42, ticket_id: ticketId, event_type: "resolution", actor_type: "system", metadata: { status: "resolved", updated_at: stamp, resolution_code: resolution }, ...options.event }];
  const service = { from(table) {
    stats.reads++; const filters = [];
    const value = (row, key) => key.includes("->>") ? row[key.split("->>")[0]]?.[key.split("->>")[1]] : row[key];
    const query = { select() { return query; }, eq(key, expected) { filters.push(row => value(row, key) === expected); stats.filters.push([key, expected]); return query; },
      in(key, expected) { filters.push(row => expected.includes(value(row, key))); return query; }, order() { return query; },
      async maybeSingle() { return { data: options.missing ? null : ticket, error: options.readError ? {} : null }; },
      async limit() { assert.equal(table, "support_ticket_events"); return { data: events.filter(row => filters.every(f => f(row))), error: options.auditError ? {} : null }; } };
    return query;
  } };
  const deps = { "next/server": { NextResponse: { json: (value, init) => Response.json(value, init) } },
    "@supabase/supabase-js": { createClient: () => { stats.clients++; return service; } },
    "../../../../lib/support-events": { recordSupportEvent: () => { throw Error("unexpected audit write"); } } };
  const m = { exports: {} };
  new Function("require", "module", "exports", "process", code)(name => deps[name], m, m.exports,
    { env: { AJG_RUN_TOKEN: "synthetic", NEXT_PUBLIC_SUPABASE_URL: "https://synthetic.invalid", SUPABASE_SECRET_KEY: "synthetic" } });
  return { stats, get: (query = `ticketId=${ticketId}&requestId=${requestId}`, token = "synthetic") => m.exports.GET(new Request(
    `https://eltara.test/api/run/support-sync?${query}`, { headers: { Authorization: `Bearer ${token}` } })) };
}
test("resolution proof requires exact central receipt and current system audit without any mutation", async () => {
  const h = harness(), response = await h.get();
  assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), { ok: true, auditRecorded: true, proof: { ticketId, requestId, status: "resolved", resolvedAt: stamp, eventId: "42", code: resolution } });
  assert.ok(h.stats.filters.some(([key, value]) => key === "metadata->>updated_at" && value === stamp));
});
test("proof endpoint authenticates and validates exact lookup before a privileged client", async () => {
  const h = harness(); assert.equal((await h.get(undefined, "wrong")).status, 401);
  for (const query of [`ticketId=${ticketId}`, `ticketId=${ticketId}&requestId=${requestId}&requestId=${requestId}`, "ticketId=wrong&requestId=req_1234abcd"]) {
    assert.equal((await h.get(query)).status, 400);
  }
  assert.equal(h.stats.clients, 0);
});
test("missing, unresolved and unavailable product tickets cannot prove closure", async () => {
  for (const [options, expected] of [[{ missing: true }, 404], [{ readError: true }, 503], [{ ticket: { status: "in_progress" } }, 409],
    [{ ticket: { resolution_code: "manual" } }, 409], [{ ticket: { resolved_at: "invalid" } }, 409]]) {
    const response = await harness(options).get(); assert.equal(response.status, expected); assert.equal((await response.json()).ok, false);
  }
});
test("an old, different, user-authored or failed audit never proves the current resolution", async () => {
  for (const options of [{ auditError: true }, { event: { actor_type: "client" } },
    { event: { metadata: { status: "resolved", updated_at: "old-version", resolution_code: resolution } } },
    { event: { ticket_id: "different-ticket" } }, { event: { id: 9007199254740992 } }]) {
    const response = await harness(options).get(); assert.equal(response.status, 503); assert.equal((await response.json()).ok, false);
  }
  assert.equal((await harness().get(`ticketId=${ticketId}&requestId=req_00000000`)).status, 503);
});
