import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const compile = path => ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const reporterCode = compile("../lib/run-intake-reporting.ts");
const agentCode = compile("../lib/support-operations-agent.ts");
const incident = { deploymentId: "dpl_synthetic", runtimeStatus: "incident", errorCount: 2, fatalCount: 0, http5xxCount: 1, source: "builder-support-operations" };

function reporter({ change = x => x, status = 201, response, token = "synthetic-token", reject = false } = {}) {
  const calls = [];
  const module = { exports: {} };
  const fetch = async (url, init) => {
    calls.push({ url, init });
    assert.equal(url, "https://ajg-infra-cockpit.vercel.app/api/run/intake");
    assert.equal(init.method, "POST");
    assert.equal(init.cache, "no-store");
    assert.ok(init.signal instanceof AbortSignal);
    assert.equal(init.headers.Authorization, "Bearer synthetic-token");
    if (reject) throw Error("private-provider-error");
    if (response) return response();
    const payload = JSON.parse(init.body);
    return Response.json(change({ ok: true, request: { ...payload, id: "req_1234abcd", status: "open" } }), { status });
  };
  new Function("require", "module", "exports", "fetch", "process", reporterCode)(
    () => { throw Error("unexpected import"); }, module, module.exports, fetch, { env: { AJG_RUN_TOKEN: token } });
  return { report: input => module.exports.reportRuntimeIncidentToRun(input || incident), calls };
}

test("runtime delivery requires the exact persisted open or triaged receipt", async () => {
  for (const status of ["open", "triaged"]) {
    const app = reporter({ change: b => ({ ...b, request: { ...b.request, status } }) });
    assert.deepEqual(await app.report(), { ok: true, skipped: false });
    assert.equal(app.calls.length, 1);
    assert.equal(app.calls[0].init.redirect, "error");
  }
});

for (const field of ["product", "source", "externalRef", "title", "kind", "id", "status"]) {
  test(`runtime receipt with mismatched ${field} does not prove delivery`, async () => {
    const app = reporter({ change: b => ({ ...b, request: { ...b.request, [field]: "private-mismatch" } }) });
    assert.deepEqual(await app.report(), { ok: false, reason: "run intake receipt unconfirmed" });
    assert.equal(app.calls.length, 1);
  });
}

test("HTTP success, empty envelopes and resolved receipts are not runtime acknowledgements", async () => {
  for (const body of [{ ok: true }, { ok: false }, { ok: true, request: null }, null, [],
    { ok: true, request: { id: "req_1234abcd", status: "resolved" } }]) {
    const app = reporter({ change: () => body });
    assert.equal((await app.report()).ok, false);
    assert.equal(app.calls.length, 1);
  }
  for (const status of [200, 202]) assert.equal((await reporter({ status }).report()).ok, false);
});

test("HTML, malformed JSON and lost responses stay unconfirmed without retries or raw errors", async () => {
  for (const config of [{ response: () => new Response("private-provider-html") },
    { response: () => new Response("{") }, { reject: true },
    { response: () => ({ ok: true, status: 201, json: async () => { throw Error("private-body-read-error"); } }) }]) {
    const app = reporter(config);
    const result = await app.report();
    assert.equal(result.ok, false);
    assert.equal(JSON.stringify(result).includes("private"), false);
    assert.equal(app.calls.length, 1);
  }
});

test("runtime reporting refuses redirects and HTTP failures without another request", async () => {
  for (const status of [301, 302, 307, 308, 401, 403, 503]) {
    const app = reporter({ status });
    assert.equal((await app.report()).ok, false);
    assert.equal(app.calls.length, 1);
    assert.equal(app.calls[0].init.redirect, "error");
  }
});

test("healthy, warning and unknown runtime observations never submit an incident", async () => {
  for (const runtimeStatus of ["healthy", "warning", "unknown"]) {
    const app = reporter();
    assert.deepEqual(await app.report({ ...incident, runtimeStatus }), { ok: true, skipped: true });
    assert.equal(app.calls.length, 0);
  }
  const missing = reporter({ token: "" });
  assert.equal((await missing.report()).ok, false);
  assert.equal(missing.calls.length, 0);
});

test("default source and unknown deployment still require their own exact receipt", async () => {
  const app = reporter();
  assert.equal((await app.report({ ...incident, source: undefined, deploymentId: null })).ok, true);
  const payload = JSON.parse(app.calls[0].init.body);
  assert.equal(payload.source, "builder-runtime-agent");
  assert.equal(payload.externalRef, "builder-runtime:unknown");
});

test("real reporter prevents the operations journal claiming an unconfirmed runtime delivery", async () => {
  for (const positive of [false, true]) {
    const app = reporter({ change: positive ? x => x : () => ({ ok: true }) });
    const writes = [];
    const service = { from(name) {
      assert.equal(name, "support_operations_runs");
      const q = { insert() { return q; }, select() { return q; }, eq() { return q; },
        single: async () => ({ data: { id: 17 }, error: null }),
        update(value) { writes.push(value); return q; } };
      return q;
    } };
    const deps = {
      "@supabase/supabase-js": {},
      "./support-central-reconcile": { runSupportCentralReconciliationSafely: async () => ({ ok: true }) },
      "./support-reconcile": { runSupportReconciliationSafely: async () => ({ ok: true }) },
      "./support-remediation-sweep": { runSupportRemediationSweepSafely: async () => ({ ok: true }) },
      "./platform-self-healing": { runPlatformSelfHealing: async () => ({ status: "healthy", actions: [] }) },
      "./vercel-runtime-health": { getRecentRuntimeHealth: async () => ({ ...incident, status: "incident", checked: true, truncated: false }) },
      "./run-intake-reporting": { reportRuntimeIncidentToRun: app.report }
    };
    const m = { exports: {} };
    new Function("require", "module", "exports", agentCode)(name => { assert.ok(name in deps, name); return deps[name]; }, m, m.exports);
    const result = await m.exports.runSupportOperationsAgent(service);
    assert.equal(result.runStatus, "attention");
    assert.equal(result.reportedToRun, positive);
    assert.equal(writes[0].reported_to_run, positive);
    assert.equal(writes[0].report_reason, positive ? "runtime_incident_reported" : "runtime_incident_reporting_failed");
    assert.deepEqual(result.errors, positive ? [] : ["run_reporting:run intake receipt unconfirmed"]);
    assert.equal(app.calls.length, 1);
  }
});
