import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import { supportScanWindow } from "../lib/support-scan-window.ts";
const stamp = "2026-10-19T10:00:00.000Z", now = new Date("2026-10-19T12:00:00Z");
const owner = "11111111-1111-4111-9111-111111111111", site = "22222222-2222-4222-9222-222222222222";
const code = "auto_verified_managed_primary_repair", source = "ajg-run-resolution-confirmed";
function load(name, deps, fetch) {
  const compiled = ts.transpileModule(fs.readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const m = { exports: {} };
  new Function("require", "module", "exports", "fetch", "process", compiled)(id => {
    assert.ok(id in deps, id); return deps[id];
  }, m, m.exports, fetch, { env: { AJG_RUN_TOKEN: "synthetic" } });
  return m.exports;
}
function makeTicket(i) {
  return { id: `33333333-3333-4333-9333-${String(i).padStart(12, "0")}`, user_id: owner, site_id: site,
    status: "resolved", category: "domain", updated_at: stamp, resolved_at: stamp, resolution_code: code };
}
function harness(options = {}) {
  const tickets = Array.from({ length: options.population ?? 1 }, (_, i) => makeTicket(i + 1));
  const requests = [], http = [], markers = new Map(), central = new Map();
  let markerLost = Boolean(options.markerLost);
  const requestId = id => `req_${Number(id.slice(-12)).toString(16).padStart(8, "0")}`;
  const repairId = id => id.replace(/^33333333/, "44444444");
  const auditId = id => String(Number(id.slice(-12)) + 100);
  const metadata = id => ({ source, request_id: requestId(id), ticket_updated_at: stamp,
    resolution_event_id: auditId(id), repair_run_id: repairId(id) });
  if (options.marker) markers.set(tickets[0].id, metadata(tickets[0].id));
  const response = (data, count) => Response.json(data, { headers: count === undefined ? {} : { "content-range": `0-${Math.max(0, data.length - 1)}/${count}` } });
  const service = createClient("https://synthetic.example.test", "synthetic", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (url, init) => {
      const u = new URL(url), table = u.pathname.split("/").at(-1);
      requests.push({ u, method: init.method, body: init.body });
      if (table === "support_tickets") {
        assert.ok(["GET", "HEAD"].includes(init.method), "never rewrite product ticket state");
        const scoped = u.searchParams.has("id");
        if (scoped) {
          assert.equal(u.searchParams.get("user_id"), `eq.${owner}`);
          assert.equal(u.searchParams.get("site_id"), `eq.${site}`);
        }
        if (init.method === "HEAD") return new Response(null, { headers: { "content-range": `*/${options.badScopeCount ? 2 : scoped ? 1 : tickets.length}` } });
        if (u.searchParams.has("category")) {
          assert.equal(u.searchParams.get("category"), "eq.domain");
          assert.equal(u.searchParams.get("resolution_code"), `eq.${code}`);
          assert.equal(u.searchParams.get("status"), "in.(resolved,closed)");
          assert.equal(u.searchParams.get("limit"), "20");
          const offset = Number(u.searchParams.get("offset") || 0);
          const rows = scoped ? [tickets.find(t => `eq.${t.id}` === u.searchParams.get("id"))] : tickets.slice(offset, offset + 20);
          return response(options.badScopeRows ? [{ ...rows[0], user_id: "other" }] : rows);
        }
        const ticket = tickets.find(t => `eq.${t.id}` === u.searchParams.get("id"));
        return response({ ...ticket, ...(options.versionRace ? { updated_at: "2026-10-19T11:00:00Z" } : {}) });
      }
      const id = (u.searchParams.get("ticket_id") || "").slice(3);
      if (table === "support_remediation_runs") {
        assert.equal(init.method, "GET", "never repeat a repair");
        return response({ id: repairId(id), ticket_id: id, user_id: options.foreignRepair ? "other" : owner,
          site_id: site, action: "managed_domain_repair", status: "succeeded", result_code: "managed_domain_primary_repaired" });
      }
      assert.equal(table, "support_ticket_events");
      if (init.method === "POST") {
        const body = JSON.parse(init.body);
        assert.equal(body.actor_type, "system"); assert.equal(body.event_type, "diagnostic");
        assert.deepEqual(body.metadata, metadata(body.ticket_id));
        markers.set(body.ticket_id, body.metadata);
        if (markerLost) { markerLost = false; throw Error("private marker detail"); }
        return response({ id: "999", ...body });
      }
      if (u.searchParams.get("metadata->>source") === "eq.ajg-run-intake") {
        const rows = [{ ticket_id: id, actor_type: "system", event_type: "diagnostic", metadata: { source: "ajg-run-intake", request_id: options.badReceipt ? "bad" : requestId(id) } }];
        return response(rows, options.truncatedReceipt ? 3 : rows.length);
      }
      if (u.searchParams.get("event_type") === "eq.resolution") {
        const rows = [{ id: auditId(id), ticket_id: id, actor_type: options.userAudit ? "client" : "system", event_type: "resolution",
          metadata: { status: "resolved", updated_at: options.staleAudit ? "old" : stamp, resolution_code: code, repair_run_id: repairId(id) } }];
        return response(rows, options.ambiguousAudit ? 2 : rows.length);
      }
      assert.equal(u.searchParams.get("metadata->>source"), `eq.${source}`);
      return response(markers.has(id) ? [{ metadata: markers.get(id) }] : []);
    } },
  });
  const reporter = load("run-intake-reporting", {}, async (url, init) => {
    const u = new URL(url);
    const body = init.method === "POST" ? JSON.parse(init.body) : null;
    const id = body?.ticketId || u.searchParams.get("ticketId");
    http.push({ method: init.method || "GET", id });
    if (init.method === "POST") {
      assert.deepEqual(body, { action: "resolve_support", ticketId: id, requestId: requestId(id) });
      if (!options.postUnconfirmed) central.set(id, "resolved");
      if (options.lostCompletionAck) throw Error("private response detail");
      return response({ ok: true, ticketId: id, requestId: requestId(id), status: "resolved", resolutionVerified: true });
    }
    if (options.centralUnknown) throw Error("private GET detail");
    const state = central.get(id) || options.centralStatus || "triaged";
    return response({ ok: true, receipt: { ticketId: options.wrongIdentity ? "other" : id, requestId: requestId(id), product: "ELTARA",
      source: "builder-support", status: state, updatedAt: stamp, ...(state === "resolved" && !options.noCentralProof ? { resolutionVerified: true } : {}) } });
  });
  const api = load("support-central-reconcile", { "./run-intake-reporting": reporter, "./support-scan-window": { supportScanWindow } });
  return { requests, http, markers, tickets,
    run: (at = now) => api.runSupportCentralReconciliationSafely(service, at),
    scoped: (id = tickets[0].id, userId = owner) => api.reconcileCentralSupportForTicket(service, userId, site, id, now) };
}

test("an exact pending central receipt permits one idempotent completion, independent readback and a version-bound marker", async () => {
  const h = harness(), r = await h.scoped();
  assert.equal(r.ok, true); assert.equal(r.completed, 1); assert.equal(r.confirmed, 1);
  assert.deepEqual(h.http.map(c => c.method), ["GET", "POST", "GET"]);
  assert.equal(h.requests.filter(c => c.method === "POST").length, 1, "only confirmation evidence is appended");
  assert.ok(h.requests.filter(c => c.u.pathname.endsWith("/support_tickets")).every(c => ["HEAD", "GET"].includes(c.method)));
});
test("already resolved central work is confirmed by GET only, then the durable marker avoids future HTTP", async () => {
  const h = harness({ centralStatus: "resolved" });
  assert.equal((await h.scoped()).confirmed, 1); assert.deepEqual(h.http.map(c => c.method), ["GET"]);
  const repeat = await h.scoped(); assert.equal(repeat.ok, true); assert.equal(repeat.alreadyConfirmed, 1);
  assert.equal(h.http.length, 1); assert.equal(h.requests.filter(c => c.method === "POST").length, 1);
});
test("lost completion and marker responses are reconciled through reads without repeating their uncertain effects", async () => {
  const ack = harness({ lostCompletionAck: true });
  assert.equal((await ack.scoped()).ok, true); assert.deepEqual(ack.http.map(c => c.method), ["GET", "POST", "GET"]);
  const marker = harness({ markerLost: true, centralStatus: "resolved" });
  const first = await marker.scoped(); assert.equal(first.ok, false); assert.equal(first.confirmed, 0);
  assert.equal((await marker.scoped()).alreadyConfirmed, 1);
  assert.equal(marker.http.length, 1); assert.equal(marker.requests.filter(c => c.method === "POST").length, 1);
});
test("missing, truncated, stale, ambiguous, user-authored or foreign product evidence prevents any central call", async () => {
  for (const options of [{ badReceipt: true }, { truncatedReceipt: true }, { staleAudit: true }, { ambiguousAudit: true }, { userAudit: true }, { foreignRepair: true }]) {
    const h = harness(options), r = await h.scoped();
    assert.equal(r.ok, false); assert.equal(r.confirmed, 0); assert.equal(h.http.length, 0); assert.equal(h.markers.size, 0);
  }
});
test("unknown or mismatched central state cannot trigger POST, and unresolved results cannot write confirmation evidence", async () => {
  for (const options of [{ centralUnknown: true }, { wrongIdentity: true }, { centralStatus: "resolved", noCentralProof: true }, { postUnconfirmed: true }, { versionRace: true }]) {
    const h = harness(options), r = await h.scoped();
    assert.equal(r.ok, false); assert.equal(r.confirmed, 0); assert.equal(h.markers.size, 0);
    if (options.centralUnknown || options.wrongIdentity || options.noCentralProof) assert.equal(h.http.some(c => c.method === "POST"), false);
    assert.doesNotMatch(JSON.stringify(r), /private/);
  }
});
test("scope rejects foreign, missing or broadened rows before any confirmation effect", async () => {
  const h = harness(); assert.equal((await h.scoped("invalid")).ok, false); assert.equal(h.requests.length, 0);
  for (const options of [{ badScopeCount: true }, { badScopeRows: true }]) {
    const x = harness(options); assert.equal((await x.scoped()).ok, false); assert.equal(x.http.length, 0);
    assert.equal(x.markers.size, 0);
  }
});
test("bounded hourly selection covers a stable backlog beyond the first page, including confirmed prefixes", async () => {
  const h = harness({ population: 21, centralStatus: "resolved" });
  for (let i = 0; i < 22; i++) {
    const r = await h.run(new Date(now.getTime() + i * 3_600_000));
    assert.equal(r.ok, true); assert.ok(r.scanned <= 20); assert.ok(r.checked <= 2);
  }
  assert.equal(h.markers.size, 21); assert.equal(new Set(h.http.map(c => c.id)).size, 21);
  assert.equal(h.http.some(c => c.method === "POST"), false);
});
