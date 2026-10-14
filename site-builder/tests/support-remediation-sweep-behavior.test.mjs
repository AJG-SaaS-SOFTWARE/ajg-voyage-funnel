import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const code = ts.transpileModule(fs.readFileSync(new URL("../lib/support-remediation-sweep.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

test("repair sweep reports failure when any attempted repair fails", async () => {
  for (const statuses of [["succeeded"], ["no_change"], ["failed"], ["succeeded", "failed"]]) {
    const sites = statuses.map((_, i) => ({ id: `site-${i}`, owner_id: "synthetic-user" }));
    const service = { from(table) {
      return {
        select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return this; }, gte() { return this; }, in() { return this; },
        then(resolve, reject) { return Promise.resolve({ data: table === "sites" ? sites : [], error: null }).then(resolve, reject); }
      };
    } };
    let calls = 0;
    const dependencies = {
      "@supabase/supabase-js": {},
      "./support-remediation": { runSupportRepair: async () => ({ status: statuses[calls++] }) }
    };
    const module = { exports: {} };
    new Function("require", "module", "exports", code)(name => dependencies[name], module, module.exports);
    const result = await module.exports.runSupportRemediationSweepSafely(new Date("2026-10-14T12:00:00Z"), service);
    assert.equal(result.attempted, statuses.length);
    assert.equal(result.failed, statuses.filter(s => s === "failed").length);
    assert.equal(result.ok, !statuses.includes("failed"));
  }
});
