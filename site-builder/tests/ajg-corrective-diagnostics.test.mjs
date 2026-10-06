import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const workflow = fs.readFileSync(
  new URL("../../.github/workflows/ajg-corrective-diagnostics.yml", import.meta.url),
  "utf8",
);
const diagnose = workflow.split("\n  diagnose:")[1].split("\n  lint_fix:")[0];
const lintFix = workflow.split("\n  lint_fix:")[1];

test("AJG corrective diagnose mode stays read-only and now includes lint", () => {
  assert.match(workflow, /repository_dispatch:/);
  assert.match(workflow, /types: \[ajg-corrective-agent\]/);
  assert.match(diagnose, /client_payload\.mode == 'diagnose'/);
  assert.match(diagnose, /contents: read/);
  assert.match(diagnose, /issues: write/);
  assert.doesNotMatch(diagnose, /contents: write/);
  assert.doesNotMatch(diagnose, /git push/);
  assert.match(diagnose, /id: typecheck/);
  assert.match(diagnose, /id: lint/);
  assert.match(diagnose, /id: tests/);
  assert.match(diagnose, /npx tsc --noEmit/);
  assert.match(diagnose, /npm run lint/);
  assert.match(diagnose, /npm test/);
  assert.match(diagnose, /lint=\$LINT/);
});

test("ELTARA lint_fix is write-capable only behind bounded safety gates", () => {
  assert.match(lintFix, /client_payload\.mode == 'lint_fix'/);
  assert.match(lintFix, /contents: write/);
  assert.match(lintFix, /pull-requests: write/);
  assert.match(lintFix, /--fix-dry-run/);
  assert.match(lintFix, /npx eslint app components lib/);
  assert.match(lintFix, /candidates\.length > 8/);
  assert.match(lintFix, /lineDelta > 250/);
  assert.match(lintFix, /supabase/);
  assert.match(lintFix, /package-lock\.json/);
  assert.match(lintFix, /main changed since diagnosis/);
  assert.doesNotMatch(lintFix, /npm install(?:\s|$)/);
});

test("ELTARA lint_fix validates the full quality gate before an audited merge", () => {
  assert.match(lintFix, /npm test/);
  assert.match(lintFix, /npm run lint/);
  assert.match(lintFix, /node --check scripts\/verify-deployment\.mjs/);
  assert.match(lintFix, /npx tsc --noEmit/);
  assert.match(lintFix, /npm run build/);
  assert.match(lintFix, /npm run test:smoke/);
  assert.match(lintFix, /gh pr create/);
  assert.match(lintFix, /pulls\/\$PR_NUMBER\/merge/);
  assert.match(lintFix, /merge_method=squash/);
});

test("AJG corrective results remain correlated and never trust free-form detail", () => {
  assert.match(workflow, /client_payload\.attempt_id/);
  assert.match(workflow, /ajg-corrective-result:v2 attempt=\$SAFE_ATTEMPT/);
  assert.match(workflow, /ajg-corrective-result:v1/);
  const runName = workflow.split("\n").find((line) => line.startsWith("run-name:"));
  assert.ok(runName);
  assert.ok(runName.includes("ajg-corrective:v2 attempt="));
  assert.ok(runName.includes("mode="));
  assert.ok(runName.includes("issue="));
  assert.ok(!runName.includes("inputs."));
  assert.ok(!runName.includes("client_payload.detail"));
});
