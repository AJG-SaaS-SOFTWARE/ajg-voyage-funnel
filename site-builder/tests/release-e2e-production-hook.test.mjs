import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync(
  new URL("../../.github/workflows/site-builder-production.yml", import.meta.url),
  "utf8"
);

test("production release validates structural FR/EN before the full AI mirror", () => {
  const prepare = workflow.indexOf("Prepare ephemeral release E2E credential");
  const deploy = workflow.indexOf("Deploy and explicitly promote tested Builder artifact");
  const publicDomain = workflow.indexOf("Verify ELTARA public domain without rolling back code");
  const structural = workflow.indexOf("Run structural FR/EN release E2E for deployed SHA");
  const full = workflow.indexOf("Run full AI FR/EN release E2E for deployed SHA");
  const managedCanary = workflow.indexOf("Verify managed-domain HTTPS canary when available");

  assert.ok(prepare >= 0);
  assert.ok(deploy > prepare);
  assert.ok(publicDomain > deploy);
  assert.ok(structural > publicDomain);
  assert.ok(full > structural);
  assert.ok(managedCanary > full);

  assert.match(workflow, /openssl rand -hex 32/);
  assert.match(workflow, /::add-mask::\$RELEASE_E2E_TOKEN/);
  assert.match(workflow, /AJG_RELEASE_E2E_TOKEN_HASH=\$RELEASE_E2E_TOKEN_HASH/);
  assert.match(workflow, /--env "AJG_RELEASE_E2E_TOKEN_HASH=\$AJG_RELEASE_E2E_TOKEN_HASH"/);
  assert.match(workflow, /https:\/\/\$PRODUCTION_ALIAS\/api\/cron\/release-e2e-structural/);
  assert.match(workflow, /https:\/\/\$PRODUCTION_ALIAS\/api\/cron\/release-e2e"/);
  assert.match(workflow, /Authorization: Bearer \$AJG_RELEASE_E2E_TOKEN/);
  assert.doesNotMatch(workflow, /vercel@60\.1\.3 crons run \/api\/cron\/release-e2e/);
  assert.doesNotMatch(workflow, /vercel@60\.1\.3 link/);
  assert.doesNotMatch(workflow, /VERCEL_TEAM_SLUG/);
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
