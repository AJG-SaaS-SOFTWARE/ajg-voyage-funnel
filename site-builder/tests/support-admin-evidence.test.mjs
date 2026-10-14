import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

function load(path, dependencies = {}) {
  const code = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(name => {
    assert.ok(name in dependencies, name);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}

test("admin RUN status requires the same recent healthy evidence as release readiness", async () => {
  const keys = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"];
  const saved = keys.map(key => process.env[key]);
  keys.forEach(key => { process.env[key] = "synthetic-test"; });
  try {
    const healthy = { status: "healthy", runtime_status: "healthy", completed_at: new Date().toISOString(), reconcile_failed: 0, remediation_failed: 0 };
    for (const [latest, expected] of [
      [null, true], [healthy, false],
      [{ ...healthy, completed_at: new Date(Date.now() - 4 * 3600000).toISOString() }, true],
      [{ ...healthy, completed_at: null }, true],
      [{ ...healthy, status: "running" }, true],
      [{ ...healthy, runtime_status: "unknown" }, true],
      [{ ...healthy, reconcile_failed: 1 }, true],
      [{ ...healthy, remediation_failed: 1 }, true]
    ]) {
      const userClient = {
        auth: { getUser: async () => ({ data: { user: { id: "synthetic-admin" } }, error: null }) },
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: "admin" }, error: null }) }) }) })
      };
      const service = { from: () => ({ select: () => ({ order: () => ({ limit: async () => ({ data: latest ? [latest] : [], error: null }) }) }) }) };
      let clients = 0;
      const route = load("../app/api/admin/support-operations/route.ts", {
        "next/server": { NextResponse: { json: (body, options) => Response.json(body, options) } },
        "@supabase/supabase-js": { createClient: () => ++clients === 1 ? userClient : service },
        "../../../../lib/support-operations-agent": {},
        "../../../../lib/support-agent-status": load("../lib/support-agent-status.ts")
      });
      const response = await route.GET(new Request("https://synthetic.test/api/admin/support-operations", { headers: { authorization: "Bearer synthetic-token" } }));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      const body = await response.json();
      assert.equal(body.attentionRequired, expected, JSON.stringify(latest));
      assert.deepEqual(body.latest, latest);
    }
  } finally {
    keys.forEach((key, index) => {
      if (saved[index] === undefined) delete process.env[key]; else process.env[key] = saved[index];
    });
  }
});
