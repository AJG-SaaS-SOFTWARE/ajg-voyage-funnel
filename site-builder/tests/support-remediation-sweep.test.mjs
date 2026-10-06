import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const sweep = fs.readFileSync(
  new URL("../lib/support-remediation-sweep.ts", import.meta.url),
  "utf8"
);
const cron = fs.readFileSync(
  new URL("../app/api/cron/support-operations/route.ts", import.meta.url),
  "utf8"
);
const agent = fs.readFileSync(
  new URL("../lib/support-operations-agent.ts", import.meta.url),
  "utf8"
);

test("remediation sweep is bounded and only scans published active sites", () => {
  assert.match(sweep, /const MAX_SCAN = 50/);
  assert.match(sweep, /const MAX_REPAIRS = 10/);
  assert.match(sweep, /\.eq\("status", "published"\)/);
  assert.match(sweep, /\.eq\("privacy_state", "active"\)/);
  assert.match(sweep, /eligible\.slice\(0, MAX_REPAIRS\)/);
});

test("remediation sweep skips custom domains and ambiguous managed-domain states", () => {
  assert.match(sweep, /domain\.kind === "custom_domain"/);
  assert.match(sweep, /managedDomains\.length > 1/);
  assert.match(sweep, /skippedCustomDomain/);
  assert.match(sweep, /skippedAmbiguous/);
});

test("remediation sweep enforces a cooldown and reuses the audited repair engine", () => {
  assert.match(sweep, /const COOLDOWN_HOURS = 6/);
  assert.match(sweep, /support_remediation_runs/);
  assert.match(sweep, /\.gte\("created_at", cooldownSince\)/);
  assert.match(sweep, /runSupportRepair\(service/);
  assert.match(sweep, /trigger: "system"/);
});

test("dedicated authenticated support cron delegates remediation to the operations agent", () => {
  const auth = cron.indexOf("authorization !== ");
  const agentCall = cron.indexOf("runSupportOperationsAgentFromEnvironment()");
  assert.ok(auth >= 0);
  assert.ok(agentCall > auth);
  assert.match(agent, /runSupportRemediationSweepSafely/);
  assert.match(agent, /remediation\.ok/);
});


test("core repair engine rechecks custom-domain absence to close selection races", () => {
  const remediation = fs.readFileSync(
    new URL("../lib/support-remediation.ts", import.meta.url),
    "utf8"
  );
  const domainRead = remediation.indexOf('.from("domains")');
  const customGuard = remediation.indexOf('code: "custom_domain_configured"');
  const managedInsert = remediation.indexOf('.insert({', customGuard);
  assert.ok(domainRead >= 0);
  assert.ok(customGuard > domainRead);
  assert.ok(managedInsert > customGuard);
});
