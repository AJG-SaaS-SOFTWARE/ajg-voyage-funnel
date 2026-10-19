import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";

function harness({ initial = { id: 17 }, completion = "ok", cleanupThrows = false, platformThrows = false, runtime = { status: "healthy", checked: true, truncated: false } } = {}) {
  const writes = [];
  let operations = 0;
  const originalFailure = new Error("synthetic_platform_failure");
  const service = createClient("https://synthetic.example.test", "synthetic-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (url, init) => {
      const body = JSON.parse(init.body);
      writes.push({ url: String(url), headers: new Headers(init.headers), body });
      if (init.method === "POST") return Response.json(initial, { status: 201 });
      assert.equal(init.method, "PATCH");
      if (body.status === "failed") {
        if (cleanupThrows) throw new Error("synthetic_cleanup_failure");
        return new Response(null, { status: 204 });
      }
      if (completion === "missing") return Response.json(null);
      if (completion === "wrong") return Response.json({ id: 18 });
      if (completion === "error") return Response.json({ message: "unavailable" }, { status: 503 });
      return Response.json({ id: 17 });
    } }
  });
  const dependencies = {
    "@supabase/supabase-js": {},
    "./support-central-reconcile": { runSupportCentralReconciliationSafely: async () => ({ ok: true, failed: 0 }) },
    "./platform-self-healing": { runPlatformSelfHealing: async () => {
      operations++;
      if (platformThrows) throw originalFailure;
      return { status: "healthy", actions: [], repaired: 0, failed: 0, backupStatusAfter: "healthy" };
    } },
    "./support-reconcile": { runSupportReconciliationSafely: async () => ({ ok: true, failed: 0 }) },
    "./support-remediation-sweep": { runSupportRemediationSweepSafely: async () => ({ ok: true, failed: 0 }) },
    "./vercel-runtime-health": { getRecentRuntimeHealth: async () => runtime },
    "./run-intake-reporting": { reportRuntimeIncidentToRun: async () => ({ ok: true }) }
  };
  const code = ts.transpileModule(fs.readFileSync(new URL("../lib/support-operations-agent.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(name => {
    assert.ok(name in dependencies, name); return dependencies[name];
  }, module, module.exports);
  return { run: () => module.exports.runSupportOperationsAgent(service), writes,
    operations: () => operations, originalFailure };
}

test("a healthy RUN requires the SDK to return its persisted completion row", async () => {
  const app = harness();
  const result = await app.run();
  assert.equal(result.runStatus, "healthy");
  assert.equal(result.runId, 17);
  assert.equal(app.operations(), 1);
  assert.equal(app.writes.length, 2);
  const completion = app.writes[1];
  const url = new URL(completion.url);
  assert.equal(url.searchParams.get("id"), "eq.17");
  assert.equal(url.searchParams.get("select"), "id");
  assert.match(completion.headers.get("prefer"), /return=representation/);
});

test("unconfirmed or unsafe journal identifiers prevent every repair operation", async () => {
  for (const initial of [null, {}, { id: 0 }, { id: -1 }, { id: 1.5 }, { id: "17" }, { id: Number.MAX_SAFE_INTEGER + 1 }]) {
    const app = harness({ initial });
    await assert.rejects(app.run(), { message: "support_operations_journal_unavailable" });
    assert.equal(app.operations(), 0);
    assert.equal(app.writes.length, 1, "do not update a journal without a confirmed identifier");
  }
});

test("missing, mismatched and failed completion writes cannot report success", async () => {
  for (const completion of ["missing", "wrong", "error"]) {
    const app = harness({ completion });
    await assert.rejects(app.run(), { message: "support_operations_completion_unconfirmed" });
    assert.equal(app.operations(), 1, "never repeat repairs after an uncertain journal write");
    assert.equal(app.writes.at(-1).body.status, "failed");
    assert.deepEqual(app.writes.at(-1).body.errors, ["support_operations_completion_unconfirmed"]);
  }
});

test("journal cleanup never replaces the failure that interrupted the RUN", async () => {
  const app = harness({ platformThrows: true, cleanupThrows: true });
  await assert.rejects(app.run(), error => error === app.originalFailure);
  assert.equal(app.writes.at(-1).body.status, "failed");
});


test("unavailable runtime cause is persisted without declaring the agent healthy", async () => {
  const app = harness({ runtime: { status: "unknown", checked: false, truncated: false, unavailableReason: "runtime_http_403" } });
  const result = await app.run();
  assert.equal(result.runStatus, "attention");
  assert.deepEqual(result.errors, ["runtime:runtime_http_403"]);
  assert.equal(app.writes[1].body.status, "attention");
  assert.deepEqual(app.writes[1].body.errors, ["runtime:runtime_http_403"]);
  assert.equal(app.operations(), 1);
});
