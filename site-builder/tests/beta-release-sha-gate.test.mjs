import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const gate = fs.readFileSync(
  new URL("../lib/private-beta-gate.ts", import.meta.url),
  "utf8"
);
const readiness = fs.readFileSync(
  new URL("../app/api/admin/release-readiness/route.ts", import.meta.url),
  "utf8"
);

test("private beta gate accepts the controlled release SHA", () => {
  assert.ok(gate.includes("process.env.AJG_RELEASE_SHA ||"));
  assert.ok(gate.includes("process.env.VERCEL_GIT_COMMIT_SHA"));
  assert.ok(gate.includes("if (!present(deploymentSha))"));
});

test("admin readiness reports the same release SHA source as health", () => {
  assert.ok(readiness.includes("process.env.AJG_RELEASE_SHA ||"));
  assert.ok(readiness.includes("process.env.VERCEL_GIT_COMMIT_SHA"));
  assert.ok(readiness.includes("commitSha: deploymentSha || null"));
  assert.ok(readiness.includes("Commit de production détecté"));
});
