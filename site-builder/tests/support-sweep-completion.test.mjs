import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import { supportScanWindow } from "../lib/support-scan-window.ts";
import { supportRecoveryIsVerified } from "../lib/support-reconcile-policy.ts";

function load(name, dependencies) {
  const source = fs.readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(id => {
    assert.ok(id in dependencies, id);
    return dependencies[id];
  }, module, module.exports);
  return module.exports;
}
const { resolveVerifiedSupportRepair } = load("support-repair-resolution", {
  "./support-reconcile-policy": { supportRecoveryIsVerified },
  "./published-domain": { preferredPublishedRootDomain: () => "example.test" },
});
const ticketId = "12345678-1234-4234-9234-123456789abc";
const repairId = "22345678-1234-4234-9234-123456789abc";
const before = "2026-10-19T10:00:00.000Z";
const after = "2026-10-19T11:00:00.000Z";
const baseTicket = () => ({ id: ticketId, user_id: "owner", site_id: "site",
  status: "diagnosed", category: "domain", updated_at: before,
  diagnosis: { checks: [{ key: "domain", status: "incident" }] },
});

function harness(options = {}) {
  const requests = [], sequence = [], repairs = [], central = [];
  let resolved = false;
  const sites = options.sites || [{ id: "site", owner_id: "owner" }];
  const ticketFor = site => ({ ...baseTicket(), site_id: site,
    id: `${sites.findIndex(item => item.id === site) + 1}2345678-1234-4234-9234-123456789abc` });
  const service = createClient("https://synthetic.example.test", "synthetic-service", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (url, init) => {
      const u = new URL(url), table = u.pathname.split("/").at(-1);
      requests.push({ url: u, method: init.method, body: init.body });
      if (init.method === "HEAD") return new Response(null, {
        headers: { "content-range": `*/${sites.length}` },
      });
      if (table === "sites") return Response.json(sites);
      if (table === "domains") return Response.json(options.domains || []);
      if (table === "support_remediation_runs") return Response.json(options.cooldown ? [{ site_id: "site" }] : []);
      if (table === "resolve_verified_primary_support_repair") {
        sequence.push("resolve");
        const body = JSON.parse(init.body);
        assert.equal(body.p_expected_updated_at, before);
        assert.equal(body.p_ticket_id, options.dynamicSites ? ticketFor(body.p_site_id).id : ticketId);
        assert.equal(body.p_user_id, "owner");
        assert.ok(sites.some(site => site.id === body.p_site_id));
        if (options.lostAck) throw new Error("private SQL detail");
        if (options.casRefused) return Response.json(null);
        resolved = true;
        return Response.json({ ticketId: body.p_ticket_id, status: "resolved", eventId: "9007199254740993",
          repairRunId: repairId, updatedAt: after });
      }
      if (table === "support_tickets") {
        if (u.searchParams.has("category")) {
          sequence.push("select");
          assert.equal(u.searchParams.get("user_id"), "eq.owner");
          assert.ok(sites.some(site => u.searchParams.get("site_id") === `eq.${site.id}`));
          assert.equal(u.searchParams.get("category"), "eq.domain");
          assert.equal(u.searchParams.get("status"), "in.(diagnosed,waiting_customer)");
          assert.equal(u.searchParams.get("limit"), "2");
          if (options.selectionError) return Response.json({ message: "private lookup" }, { status: 500 });
          if (options.emptySecond && u.searchParams.get("site_id") === "eq.second") return Response.json([]);
          if (options.dynamicSites) return Response.json([ticketFor(u.searchParams.get("site_id").slice(3))]);
          return Response.json(options.tickets ?? [baseTicket()]);
        }
        sequence.push("ticket-readback");
        return Response.json({ id: u.searchParams.get("id").slice(3), status: options.unconfirmedTicket ? "diagnosed" : "resolved",
          resolution_code: "auto_verified_managed_primary_repair", updated_at: after });
      }
      if (table === "support_ticket_events") {
        sequence.push("audit-readback");
        return Response.json({ ticket_id: u.searchParams.get("ticket_id").slice(3), actor_type: "system", event_type: "resolution",
          metadata: { status: "resolved", resolution_code: "auto_verified_managed_primary_repair",
            repair_run_id: options.wrongAudit ? "wrong" : repairId, previous_updated_at: before, updated_at: after } });
      }
      throw new Error(`Unexpected synthetic table ${table}`);
    } },
  });
  const { runSupportRemediationSweepSafely: run } = load("support-remediation-sweep", {
    "@supabase/supabase-js": {}, "./support-scan-window": { supportScanWindow },
    "./support-remediation": { runSupportRepair: async (_service, input) => {
      sequence.push("repair"); repairs.push(input);
      return { action: "managed_domain_repair", siteId: input.siteId, status: "succeeded",
        changed: true, code: "managed_domain_primary_repaired", verified: true, audited: true,
        ...options.repair };
    } },
    "./support-health-server": { createSupportHealthDiagnoser: () => async (owner, site) => {
      sequence.push("diagnose");
      assert.equal(owner, "owner");
      if (options.diagnosisThrows) throw new Error("private diagnosis detail");
      return { siteId: site, diagnosis: { checks: ["backend", "public_render", "domain"]
        .map(key => ({ key, status: options.unhealthy && key === "domain" ? "action" : "healthy" })) } };
    } },
    "./support-repair-resolution": { resolveVerifiedSupportRepair },
    "./run-intake-reporting": { completeVerifiedSupportRepairInRun: async (_service, id) => {
      assert.equal(resolved, true);
      assert.ok(sequence.includes("ticket-readback") && sequence.includes("audit-readback"));
      sequence.push("central"); central.push(id);
      return options.centralConfirmed !== false;
    } },
  });
  return { run: () => run(new Date(after), service), requests, sequence, repairs, central };
}

test("scheduled repair binds the unique owned ticket before mutation and confirms central completion after audited readback", async () => {
  const h = harness(), result = await h.run();
  assert.equal(result.ok, true);
  assert.equal(result.succeeded, 1);
  assert.equal(result.ticketsResolved, 1);
  assert.equal(result.centralResolutionsVerified, 1);
  assert.equal(result.ticketCompletionFailures, 0);
  assert.deepEqual(h.sequence, ["select", "repair", "diagnose", "resolve", "ticket-readback", "audit-readback", "central"]);
  assert.deepEqual(h.repairs[0], { userId: "owner", siteId: "site", action: "managed_domain_repair", trigger: "system", ticketId });
  assert.deepEqual(h.central, [ticketId]);
});

test("no ticket preserves the bounded maintenance repair without claiming a support closure", async () => {
  const h = harness({ tickets: [] }), r = await h.run();
  assert.equal(r.ok, true); assert.equal(r.attempted, 1); assert.equal(r.ticketsResolved, 0);
  assert.equal(h.repairs[0].ticketId, null); assert.deepEqual(h.sequence, ["select", "repair"]);
});

test("ambiguous, inaccessible, foreign, terminal and malformed ticket snapshots block mutation", async () => {
  for (const options of [
    { tickets: [baseTicket(), baseTicket()] }, { selectionError: true }, { tickets: [null] },
    ...[{ user_id: "other" }, { site_id: "other" }, { status: "closed" }, { category: "billing" },
      { id: null }, { updated_at: "invalid" }].map(change => ({ tickets: [{ ...baseTicket(), ...change }] })),
  ]) {
    const h = harness(options), r = await h.run();
    assert.equal(r.ok, false); assert.equal(r.attempted, 0); assert.equal(r.ticketCompletionFailures, 1);
    assert.equal(h.repairs.length, 0); assert.equal(h.central.length, 0);
    assert.doesNotMatch(JSON.stringify(r), /private lookup/);
  }
});

test("unverified repairs, missing recovery, lost ACK, stale CAS and wrong audit never authorize central completion", async () => {
  for (const options of [{ repair: { status: "failed" } }, { repair: { verified: false } },
    { repair: { audited: false } }, { repair: { code: "managed_domain_created_and_verified" } },
    { unhealthy: true }, { casRefused: true }, { lostAck: true }, { wrongAudit: true },
    { unconfirmedTicket: true }, { diagnosisThrows: true }]) {
    const h = harness(options), r = await h.run();
    assert.equal(r.ok, false); assert.equal(r.centralResolutionsVerified, 0); assert.equal(h.central.length, 0);
    assert.equal(h.repairs.length, 1, "do not replay an uncertain mutation");
    assert.ok(h.sequence.filter(x => x === "resolve").length <= 1, "do not replay the resolution RPC");
    assert.doesNotMatch(JSON.stringify(r), /private SQL|private diagnosis/);
  }
});

test("an unconfirmed central result stays distinct from a proven product resolution and independent sites continue", async () => {
  const h = harness({ centralConfirmed: false, sites: [{ id: "site", owner_id: "owner" }, { id: "second", owner_id: "owner" }], emptySecond: true });
  const r = await h.run();
  assert.equal(r.ok, false); assert.equal(r.attempted, 2); assert.equal(r.succeeded, 2);
  assert.equal(r.failed, 0); assert.equal(r.ticketsResolved, 1); assert.equal(r.centralResolutionsVerified, 0);
  assert.equal(r.ticketCompletionFailures, 1); assert.equal(r.error, "support_repair_central_resolution_unconfirmed");
  assert.equal(h.central.length, 1); assert.equal(h.repairs.length, 2);
});

test("custom domains, ambiguous domain state and cooldown cause no ticket lookup or closure", async () => {
  for (const options of [{ domains: [{ site_id: "site", kind: "custom_domain" }] },
    { domains: [1, 2].map(() => ({ site_id: "site", kind: "managed_subdomain" })) }, { cooldown: true }]) {
    const h = harness(options), r = await h.run();
    assert.equal(r.attempted, 0); assert.equal(r.centralResolutionsVerified, 0);
    assert.deepEqual(h.sequence, []);
  }
});

test("a cycle caps linked repairs while preserving each selected ticket and defers the remaining site", async () => {
  const h = harness({ dynamicSites: true, sites: ["site", "second", "third"].map(id => ({ id, owner_id: "owner" })) });
  const r = await h.run();
  assert.equal(r.ok, true); assert.equal(r.eligible, 3); assert.equal(r.attempted, 2);
  assert.equal(r.ticketsResolved, 2); assert.equal(r.centralResolutionsVerified, 2);
  assert.equal(r.skippedTicketBudget, 1);
  assert.equal(new Set(h.repairs.map(input => input.siteId)).size, 2);
  assert.deepEqual(h.repairs.map(input => input.ticketId), h.central);
  assert.equal(new Set(h.central).size, 2);
});
