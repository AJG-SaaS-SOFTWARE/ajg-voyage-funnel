import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../app/api/run/remediate/route.ts", import.meta.url),
  "utf8",
);

test("internal autonomous run endpoint requires a dedicated server-side run token", () => {
  assert.match(source, /AJG_RUN_TOKEN/);
  assert.match(source, /status:\s*401/);
});

test("internal autonomous run endpoint allows only deterministic low-risk actions", () => {
  assert.match(source, /"support_reconcile"/);
  assert.match(source, /"support_remediation_sweep"/);
  assert.match(source, /"storage_backup"/);
  assert.doesNotMatch(source, /stripe/i);
  assert.doesNotMatch(source, /delete/i);
});
