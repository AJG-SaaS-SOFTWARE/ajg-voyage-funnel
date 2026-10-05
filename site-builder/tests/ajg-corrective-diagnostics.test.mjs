import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const workflow = fs.readFileSync(
  new URL("../../.github/workflows/ajg-corrective-diagnostics.yml", import.meta.url),
  "utf8",
);

test("AJG corrective diagnostics stays read-only", () => {
  assert.match(workflow, /repository_dispatch:/);
  assert.match(workflow, /types: \[ajg-corrective-agent\]/);
  assert.match(workflow, /client_payload\.mode == 'diagnose'/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /issues: write/);
  assert.doesNotMatch(workflow, /contents: write/);
  assert.doesNotMatch(workflow, /vercel deploy/);
  assert.doesNotMatch(workflow, /git push/);
});

test("AJG corrective diagnostics executes ELTARA checks only", () => {
  assert.match(workflow, /working-directory: site-builder/);
  assert.match(workflow, /npx tsc --noEmit/);
  assert.match(workflow, /npm test/);
});
