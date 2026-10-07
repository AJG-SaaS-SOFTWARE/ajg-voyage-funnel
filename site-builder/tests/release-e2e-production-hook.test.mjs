import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync(
  new URL("../../.github/workflows/site-builder-production.yml", import.meta.url),
  "utf8"
);

test("production release validates structural FR/EN before the full AI mirror", () => {
  const publicDomain = workflow.indexOf("Verify ELTARA public domain without rolling back code");
  const linkContext = workflow.indexOf("Link ELTARA project context for Vercel Cron CLI");
  const structural = workflow.indexOf("Run structural FR/EN release E2E for deployed SHA");
  const full = workflow.indexOf("Run full AI FR/EN release E2E for deployed SHA");
  const managedCanary = workflow.indexOf("Verify managed-domain HTTPS canary when available");

  assert.ok(publicDomain >= 0);
  assert.ok(linkContext > publicDomain);
  assert.ok(structural > linkContext);
  assert.ok(full > structural);
  assert.ok(managedCanary > full);
  assert.match(workflow, /vercel@60\.1\.3 crons run \/api\/cron\/release-e2e-structural/);
  assert.match(workflow, /vercel@60\.1\.3 crons run \/api\/cron\/release-e2e/);
  assert.match(workflow, /--token "\$VERCEL_TOKEN"/);
  assert.match(workflow, /\.vercel\/project\.json/);
  assert.match(workflow, /JSON\.stringify\(\{ orgId, projectId \}\)/);
  assert.match(workflow, /rm -rf \.vercel/);
});

test("post-release structural and AI E2E failures never invoke rollback", () => {
  const stepStart = workflow.indexOf("Run structural FR/EN release E2E for deployed SHA");
  const nextStep = workflow.indexOf("Verify managed-domain HTTPS canary when available");
  const block = workflow.slice(stepStart, nextStep);

  assert.match(block, /Structural FR\/EN release E2E failed/);
  assert.match(block, /Full AI FR\/EN release E2E failed/);
  assert.match(block, /no automatic rollback is requested/);
  assert.doesNotMatch(block, /\/rollback\//);
  assert.doesNotMatch(block, /PREVIOUS_DEPLOYMENT_ID/);
});
