import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createHash } from "node:crypto";

const compile = file => ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const policyCode = compile("../lib/storage-backup-policy.ts");
const statusCode = compile("../lib/storage-backup.ts");
const now = Date.parse("2026-10-19T20:00:00.000Z");
class ObservedDate extends Date { static now() { return now; } }

function harness(lastCompletedAt) {
  const stats = { reads: [], mutations: 0, clients: 0 };
  const policy = { exports: {} };
  new Function("module", "exports", "Date", policyCode)(policy, policy.exports, ObservedDate);
  const forbidden = () => { stats.mutations++; throw Error("Unexpected backup mutation"); };
  const dependencies = {
    "server-only": {}, "node:crypto": { createHash },
    "@supabase/supabase-js": { createClient: () => { stats.clients++; throw Error("Unexpected SDK client"); } },
    "./storage-backup-policy": policy.exports,
    "./vercel-private-blob": {
      privateBlobConfigured: async () => true,
      listPrivateBlobs: async (prefix, limit) => {
        stats.reads.push({ prefix, limit });
        return { ok: true, data: { blobs: [{ pathname: "ajg-site-builder-backups/state.json", url: "https://blob.example.invalid/state.json" }] } };
      },
      readPrivateJson: async url => { stats.reads.push({ url }); return { ok: true, data: {
        version: 1, lastCompletedAt, retentionDays: 35, entries: {}, lastRun: { sourceObjects: 0 }
      } }; },
      putPrivateBlob: forbidden, putPrivateJson: forbidden, deletePrivateBlobs: forbidden,
      listAllPrivateBlobs: forbidden
    }
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", "process", statusCode)(name => {
    assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name];
  }, module, module.exports, { env: { NEXT_PUBLIC_SUPABASE_URL: "https://fixture.example.invalid", SUPABASE_SECRET_KEY: "fixture-only" } });
  return { stats, read: module.exports.getStorageBackupStatus };
}

for (const stamp of ["2026-10-19T20:00:00.001Z", "2027-10-19T20:00:00.000Z", 1]) {
  test(`actual backup status reader preserves unknown freshness without writes: ${stamp}`, async () => {
    const app = harness(stamp), result = await app.read();
    assert.equal(result.configured, true);
    assert.equal(result.status, "unknown"); assert.equal(result.ageHours, null);
    assert.equal(result.lastCompletedAt, stamp); // no rewriting the stored evidence
    assert.equal(result.sourceObjects, 0); assert.equal(result.retentionDays, 35);
    assert.equal(app.stats.reads.length, 2);
    assert.equal(app.stats.mutations, 0); assert.equal(app.stats.clients, 0);
  });
}

test("actual status reader retains valid recent and stale classifications without writes", async () => {
  for (const [hours, expected] of [[0, "healthy"], [36, "healthy"], [48, "warning"], [73, "critical"]]) {
    const app = harness(new Date(now - hours * 3_600_000).toISOString());
    const result = await app.read();
    assert.equal(result.status, expected); assert.equal(result.ageHours, hours);
    assert.equal(app.stats.mutations, 0); assert.equal(app.stats.clients, 0);
  }
});
