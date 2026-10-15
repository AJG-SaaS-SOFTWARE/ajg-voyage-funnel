import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { supportScanWindow } from "../lib/support-scan-window.ts";

const code = ts.transpileModule(fs.readFileSync(new URL("../lib/support-remediation-sweep.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

test("repair sweep reports failure when any attempted repair fails", async () => {
  for (const statuses of [["succeeded"], ["no_change"], ["failed"], ["succeeded", "failed"]]) {
    const sites = statuses.map((_, i) => ({ id: `site-${i}`, owner_id: "synthetic-user" }));
    const service = { from(table) {
      let counting = false;
      return {
        select(_columns, options) { counting = Boolean(options?.head); return this; }, eq() { return this; }, order() { return this; }, limit() { return this; }, range() { return this; }, gte() { return this; }, in() { return this; },
        then(resolve, reject) { return Promise.resolve({ data: counting ? null : table === "sites" ? sites : [], count: counting ? sites.length : null, error: null }).then(resolve, reject); }
      };
    } };
    let calls = 0;
    const dependencies = {
      "@supabase/supabase-js": {},
      "./support-scan-window": { supportScanWindow },
      "./support-remediation": { runSupportRepair: async () => ({ status: statuses[calls++], verified: true, audited: true }) }
    };
    const module = { exports: {} };
    new Function("require", "module", "exports", code)(name => dependencies[name], module, module.exports);
    const result = await module.exports.runSupportRemediationSweepSafely(new Date("2026-10-14T12:00:00Z"), service);
    assert.equal(result.attempted, statuses.length);
    assert.equal(result.failed, statuses.filter(s => s === "failed").length);
    assert.equal(result.ok, !statuses.includes("failed"));
  }
});


test("repair sweep preserves progress and continues independent sites after a thrown repair", async () => {
  const sites = [0, 1, 2].map(i => ({ id: `site-${i}`, owner_id: "synthetic-user" }));
  const service = { from(table) {
    let counting = false;
    return {
      select(_columns, options) { counting = Boolean(options?.head); return this; },
      eq() { return this; }, order() { return this; }, limit() { return this; },
      range() { return this; }, gte() { return this; }, in() { return this; },
      then(resolve, reject) { return Promise.resolve({ data: counting ? null : table === "sites" ? sites : [], count: counting ? sites.length : null, error: null }).then(resolve, reject); }
    };
  } };
  for (const throwAt of [0, 1, 2]) {
    const called = [];
    const module = { exports: {} };
    const dependencies = {
      "@supabase/supabase-js": {},
      "./support-scan-window": { supportScanWindow },
      "./support-remediation": { runSupportRepair: async (_service, input) => {
        called.push(input.siteId);
        if (called.length - 1 === throwAt) throw new Error("private provider detail");
        return { status: "succeeded", verified: true, audited: true };
      } }
    };
    new Function("require", "module", "exports", code)(name => dependencies[name], module, module.exports);
    const result = await module.exports.runSupportRemediationSweepSafely(new Date("2026-10-14T12:00:00Z"), service);
    assert.equal(result.ok, false);
    assert.equal(result.scanned, 3);
    assert.equal(result.eligible, 3);
    assert.equal(result.attempted, 3);
    assert.equal(result.succeeded, 2);
    assert.equal(result.failed, 1);
    assert.equal(result.error, "support_repair_execution_failed");
    assert.equal(new Set(called).size, 3, "each site is attempted exactly once");
    assert.doesNotMatch(JSON.stringify(result), /private provider detail/);
  }
});
