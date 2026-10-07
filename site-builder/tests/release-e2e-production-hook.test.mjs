import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync(
  new URL("../../.github/workflows/site-builder-production.yml", import.meta.url),
  "utf8"
);

test("production release triggers guarded mirrored FR/EN E2E after official-domain health", () => {
  const publicDomain = workflow.indexOf("Verify ELTARA public domain without rolling back code");
  const releaseE2E = workflow.indexOf("Run mirrored FR/EN release E2E for deployed SHA");
  const managedCanary = workflow.indexOf("Verify managed-domain HTTPS canary when available");

  assert.ok(publicDomain >= 0);
  assert.ok(releaseE2E > publicDomain);
  assert.ok(managedCanary > releaseE2E);
  assert.match(workflow, /vercel@60\.1\.3 crons run \/api\/cron\/release-e2e/);
  assert.match(workflow, /--token "\$VERCEL_TOKEN"/);
  assert.match(workflow, /Mirrored FR\/EN release E2E failed for \$GITHUB_SHA/);
  assert.match(workflow, /no automatic rollback is requested/);
});

test("post-release E2E failure does not invoke the rollback endpoint", () => {
  const stepStart = workflow.indexOf("Run mirrored FR/EN release E2E for deployed SHA");
  const nextStep = workflow.indexOf("Verify managed-domain HTTPS canary when available");
  const block = workflow.slice(stepStart, nextStep);

  assert.doesNotMatch(block, /\/rollback\//);
  assert.doesNotMatch(block, /PREVIOUS_DEPLOYMENT_ID/);
  assert.match(block, /exit "\$CRON_EXIT"/);
});
