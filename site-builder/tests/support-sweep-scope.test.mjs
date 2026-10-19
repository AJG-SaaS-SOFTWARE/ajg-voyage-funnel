import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import { supportScanWindow } from "../lib/support-scan-window.ts";
const owner = "11111111-1111-4111-9111-111111111111";
const site = "22222222-2222-4222-9222-222222222222";
const code = ts.transpileModule(fs.readFileSync(new URL("../lib/support-remediation-sweep.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
new Function("require", "module", "exports", code)(id => id === "./support-scan-window" ? { supportScanWindow } : {}, module, module.exports);

function harness({ count = 1, rows = [{ id: site, owner_id: owner }] } = {}) {
  const requests = [];
  const service = createClient("https://synthetic.example.test", "synthetic-service", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (url, init) => {
      const u = new URL(url); requests.push({ u, method: init.method });
      if (u.pathname.endsWith("/sites")) {
        assert.equal(u.searchParams.get("id"), `eq.${site}`);
        assert.equal(u.searchParams.get("owner_id"), `eq.${owner}`);
        assert.equal(u.searchParams.get("status"), "eq.published");
        assert.equal(u.searchParams.get("privacy_state"), "eq.active");
        return init.method === "HEAD" ? new Response(null, { headers: { "content-range": `*/${count}` } }) : Response.json(rows);
      }
      assert.equal(u.searchParams.get("site_id"), `in.(${site})`);
      if (u.pathname.endsWith("/domains")) return Response.json([{ site_id: site, kind: "managed_subdomain", verification_status: "verified", is_primary: true }]);
      if (u.pathname.endsWith("/support_remediation_runs")) return Response.json([]);
      throw new Error("Unexpected query");
    } },
  });
  return { requests, run: (user = owner, target = site) => module.exports.runSupportRemediationSweepForSite(service, user, target) };
}
test("scoped sweep constrains both count and row reads to the exact owned fixture", async () => {
  const h = harness(), result = await h.run();
  assert.equal(result.ok, true); assert.equal(result.scanned, 1); assert.equal(result.attempted, 0);
  assert.equal(h.requests.length, 4);
});
test("invalid identities cause no query and absent or broadened scope cannot start a repair", async () => {
  const h = harness();
  assert.equal((await h.run("invalid")).ok, false); assert.equal((await h.run(owner, "")).ok, false);
  assert.equal(h.requests.length, 0);
  for (const options of [{ count: 0 }, { count: 2 }, { rows: [] },
    { rows: [{ id: site, owner_id: "other" }] }, { rows: [{ id: site, owner_id: owner }, { id: "other", owner_id: owner }] }]) {
    const scoped = harness(options), result = await scoped.run();
    assert.equal(result.ok, false); assert.equal(result.attempted, 0);
    assert.equal(result.error, "support_remediation_scope_unconfirmed");
    assert.ok(scoped.requests.every(request => request.u.pathname.endsWith("/sites")));
  }
});
