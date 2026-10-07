import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync(
  new URL("../../.github/workflows/eltara-visual-review.yml", import.meta.url),
  "utf8"
);

test("visual review runs after a successful ELTARA production release or manually", () => {
  assert.match(workflow, /ELTARA Production Release/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /eltara\.ajgsolutionsgroup\.com/);
});

test("visual review captures mirrored FR EN desktop and mobile evidence", () => {
  assert.match(workflow, /fr-FR/);
  assert.match(workflow, /en-US/);
  assert.match(workflow, /1440,1000/);
  assert.match(workflow, /390,844/);
  assert.match(workflow, /home:\//);
  assert.match(workflow, /login:\/login/);

  for (const path of [
    "/mentions-legales",
    "/confidentialite",
    "/cgv",
    "/resilier",
    "/legal",
    "/privacy",
    "/terms",
    "/cancel"
  ]) {
    assert.ok(workflow.includes(path), `missing visual capture for ${path}`);
  }

  assert.match(workflow, /test "\$count" = "24"/);
  assert.match(workflow, /curl --fail --silent --show-error --location --max-time 15/);
});

test("visual review evidence is SHA-bound and tamper-evident", () => {
  assert.match(workflow, /REVIEW_SHA:/);
  assert.match(workflow, /SURFACE_SET_VERSION: customer-core-v1/);
  assert.match(workflow, /manifest\.json/);
  assert.match(workflow, /deploymentSha: process\.env\.REVIEW_SHA/);
  assert.match(workflow, /surfaceSetVersion: process\.env\.SURFACE_SET_VERSION/);
  assert.match(workflow, /crypto\.createHash\("sha256"\)/);
  assert.match(workflow, /screenshotCount: files\.length/);
  assert.match(workflow, /sha256sum artifacts\/eltara-visual-review\/\*\.png/);
  assert.match(workflow, /SHA256SUMS/);
});

test("visual review is deterministic, read-only and retains evidence", () => {
  assert.match(workflow, /PLAYWRIGHT_VERSION: 1\.55\.0/);
  assert.match(workflow, /--browser chromium/);
  assert.match(workflow, /--full-page/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /retention-days: 14/);
  assert.match(workflow, /permissions:\n  contents: read/);
  for (const forbidden of ["VERCEL_TOKEN", "SUPABASE", "OPENAI", "STRIPE", "AJG_BILLING", "/api/billing/checkout"]) {
    assert.ok(!workflow.includes(forbidden), `visual review must not reference ${forbidden}`);
  }
  assert.doesNotMatch(workflow, /curl\s+-X\s+(POST|PUT|PATCH|DELETE)/i);
});
