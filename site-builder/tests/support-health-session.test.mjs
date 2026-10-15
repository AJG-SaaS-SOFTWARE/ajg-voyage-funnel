import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import { buildSupportDiagnosis } from "../lib/support-diagnostics.ts";

function harness() {
  const stats = { backup: 0, buckets: 0, quota: [], requests: [], publicRequests: [] };
  const state = { clock: 0, storageOk: true, aiEnabled: true, backupStatus: "healthy", backupGate: null, publicOk: true };
  const sites = ["alice", "bob"].map(owner => ({ id: `${owner}-site`, owner_id: owner, slug: owner,
    status: "draft", public_access_state: "live", config: {} }));
  const service = createClient("https://synthetic.example.test", "test-only", {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async input => {
      const url = new URL(input); stats.requests.push(url);
      const table = url.pathname.split("/").at(-1);
      if (table === "sites") return Response.json(sites.filter(site =>
        url.searchParams.get("owner_id") === `eq.${site.owner_id}` &&
        (!url.searchParams.has("id") || url.searchParams.get("id") === `eq.${site.id}`)));
      if (table === "domains") return Response.json([{ hostname: `${url.searchParams.get("site_id").slice(3)}.example.test`,
        kind: "managed_subdomain", verification_status: "verified", is_primary: true }]);
      if (table === "site_billing_states") return Response.json({ state: "active" });
      if (table === "ai_cost_policy") return Response.json({ ai_enabled: state.aiEnabled, heavy_enabled: true });
      if (url.pathname.includes("/storage/v1/bucket/")) {
        stats.buckets++;
        return state.storageOk ? Response.json({ id: table, name: table }) : Response.json({ message: "unavailable" }, { status: 503 });
      }
      throw new Error(`Unexpected SDK request: ${url}`);
    } }
  });
  const dependencies = {
    "./app-url": { appBaseUrl: () => "https://unused.test" },
    "./storage-backup": { getStorageBackupStatus: async () => {
      stats.backup++;
      if (state.backupGate) await state.backupGate;
      return { configured: true, status: state.backupStatus, ageHours: 1 };
    } },
    "./external-link-health": { probeHttpsLinks: async () => [] },
    "./ai-quota-health": { getAiQuotaHealth: async (_service, userId, siteId) => {
      stats.quota.push({ userId, siteId });
      return { planKey: "essential", planName: "Essentiel", status: "healthy",
        minute: { used: 0, limit: 10 }, daily: { used: 0, limit: 10 }, monthly: { used: 0, limit: 100 } };
    } },
    "./support-diagnostics": { buildSupportDiagnosis }
  };
  const code = ts.transpileModule(fs.readFileSync(new URL("../lib/support-health-server.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", "performance", "fetch", code)(name => {
    assert.ok(name in dependencies, name); return dependencies[name];
  }, module, module.exports, { now: () => state.clock }, async url => {
    stats.publicRequests.push(url);
    return url.endsWith("sitemap.xml")
      ? new Response('<urlset><url><loc>https://example.test</loc></url></urlset>', { headers: { "content-type": "application/xml" } })
      : new Response('<link rel="canonical" href="https://example.test">', { status: state.publicOk ? 200 : 503 });
  });
  return { service, state, stats, sites, ...module.exports };
}

test("one execution shares only infrastructure while ownership, policy and quotas remain fresh", async () => {
  const app = harness();
  const diagnose = app.createSupportHealthDiagnoser(app.service);
  const alice = await diagnose("alice", "alice-site");
  app.state.aiEnabled = false;
  const bob = await diagnose("bob", "bob-site");
  assert.equal(alice.siteId, "alice-site"); assert.equal(bob.siteId, "bob-site");
  assert.ok(alice.diagnosis.checks.find(check => check.key === "domain").detail.includes("alice-site"));
  assert.ok(bob.diagnosis.checks.find(check => check.key === "domain").detail.includes("bob-site"));
  assert.equal(alice.diagnosis.checks.find(check => check.key === "ai").status, "healthy");
  assert.equal(bob.diagnosis.checks.find(check => check.key === "ai").status, "incident");
  assert.equal(app.stats.backup, 1); assert.equal(app.stats.buckets, 2);
  assert.deepEqual(app.stats.quota, [{ userId: "alice", siteId: "alice-site" }, { userId: "bob", siteId: "bob-site" }]);
  assert.equal(app.stats.requests.filter(url => url.pathname.endsWith("/ai_cost_policy")).length, 2);
  for (const table of ["domains", "site_billing_states"]) assert.equal(app.stats.requests.filter(url => url.pathname.endsWith(`/${table}`)).length, 2);
  const unauthorized = await diagnose("alice", "bob-site");
  assert.equal(unauthorized.siteId, null); assert.equal(app.stats.backup, 1);
  assert.equal(app.stats.quota.length, 2);
});

test("public rendering and sitemap probes are never part of the shared snapshot", async () => {
  const app = harness(); app.sites[0].status = "published";
  const diagnose = app.createSupportHealthDiagnoser(app.service);
  const first = await diagnose("alice", "alice-site");
  app.state.publicOk = false;
  const second = await diagnose("alice", "alice-site");
  assert.equal(first.diagnosis.checks.find(check => check.key === "public_render").status, "healthy");
  assert.equal(second.diagnosis.checks.find(check => check.key === "public_render").status, "incident");
  assert.equal(app.stats.publicRequests.length, 4);
  assert.equal(app.stats.backup, 1); assert.equal(app.stats.buckets, 2);
});

test("the snapshot expires at thirty seconds and newly failing infrastructure is not reported healthy", async () => {
  const app = harness(); const diagnose = app.createSupportHealthDiagnoser(app.service);
  await diagnose("alice", "alice-site");
  app.state.clock = 29_999;
  await diagnose("bob", "bob-site"); assert.equal(app.stats.backup, 1);
  app.state.clock = 30_000; app.state.storageOk = false; app.state.backupStatus = "critical";
  const result = await diagnose("bob", "bob-site");
  assert.equal(app.stats.backup, 2); assert.equal(app.stats.buckets, 4);
  for (const key of ["storage", "backup"]) assert.equal(result.diagnosis.checks.find(check => check.key === key).status, "incident");
});

test("independent executions and direct diagnostics never inherit a previous snapshot", async () => {
  const app = harness();
  await app.createSupportHealthDiagnoser(app.service)("alice", "alice-site");
  await app.createSupportHealthDiagnoser(app.service)("bob", "bob-site");
  await app.diagnoseSupportHealth(app.service, "alice", "alice-site");
  await app.diagnoseSupportHealth(app.service, "alice", "alice-site");
  assert.equal(app.stats.backup, 4); assert.equal(app.stats.buckets, 8);
});

test("simultaneous site diagnostics coalesce an in-flight infrastructure read", async () => {
  const app = harness(); let release;
  app.state.backupGate = new Promise(resolve => { release = resolve; });
  const diagnose = app.createSupportHealthDiagnoser(app.service);
  const first = diagnose("alice", "alice-site"), second = diagnose("bob", "bob-site");
  for (let tick = 0; tick < 5; tick++) await new Promise(setImmediate);
  assert.equal(app.stats.backup, 1); assert.equal(app.stats.buckets, 2);
  release();
  assert.deepEqual((await Promise.all([first, second])).map(result => result.siteId), ["alice-site", "bob-site"]);
});
