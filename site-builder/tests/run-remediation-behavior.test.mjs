import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const code = ts.transpileModule(fs.readFileSync(new URL("../app/api/run/remediate/route.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

test("cockpit RUN validates authentication and action before any effect", async () => {
  const saved = process.env.AJG_RUN_TOKEN;
  process.env.AJG_RUN_TOKEN = "synthetic-run-token";
  let calls = 0;
  let outcome = { ok: true };
  const run = async () => { calls++; if (outcome instanceof Error) throw outcome; return outcome; };
  const dependencies = {
    "next/server": { NextResponse: { json: (body, options) => Response.json(body, options) } },
    "../../../../lib/storage-backup": { runStorageBackup: run },
    "../../../../lib/support-reconcile": { runSupportReconciliationSafely: run },
    "../../../../lib/support-remediation-sweep": { runSupportRemediationSweepSafely: run },
    "../../../../lib/support-operations-agent": { runSupportOperationsAgentFromEnvironment: run }
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(name => dependencies[name], module, module.exports);
  const request = (action, token = "synthetic-run-token") => new Request("https://synthetic.test/api/run/remediate", {
    method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ action })
  });
  try {
    for (const token of ["", "wrong", "synthetic-run-tokeX"]) {
      assert.equal((await module.exports.POST(request("support_operations_agent", token))).status, 401);
    }
    assert.equal(calls, 0);
    assert.equal((await module.exports.POST(request("unknown"))).status, 400);
    assert.equal((await module.exports.POST(new Request("https://synthetic.test", { method: "POST", headers: { authorization: "Bearer synthetic-run-token" }, body: "{" }))).status, 400);
    assert.equal(calls, 0);
    for (const action of ["support_operations_agent", "support_reconcile", "support_remediation_sweep", "storage_backup"]) {
      outcome = { ok: true };
      assert.equal((await module.exports.POST(request(action))).status, 200);
      outcome = { ok: false, configured: true };
      const response = await module.exports.POST(request(action));
      assert.equal(response.status, 503);
      assert.equal((await response.json()).ok, false);
    }
    outcome = { ok: false, configured: false };
    assert.equal((await module.exports.POST(request("storage_backup"))).status, 409);
    outcome = new Error("synthetic failure");
    assert.equal((await module.exports.POST(request("support_operations_agent"))).status, 500);
    const before = calls;
    delete process.env.AJG_RUN_TOKEN;
    assert.equal((await module.exports.POST(request("support_operations_agent"))).status, 401);
    assert.equal(calls, before);
  } finally {
    if (saved === undefined) delete process.env.AJG_RUN_TOKEN; else process.env.AJG_RUN_TOKEN = saved;
  }
});
