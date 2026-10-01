import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const sweep = fs.readFileSync(
  new URL("../lib/support-remediation-sweep.ts", import.meta.url),
  "utf8"
);
const cron = fs.readFileSync(
  new URL("../app/api/cron/storage-backup/route.ts", import.meta.url),
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

test("existing authenticated daily cron runs remediation without adding a schedule", () => {
  const auth = cron.indexOf("authorization !== ");
  const remediation = cron.indexOf("runSupportRemediationSweepSafely()");
  assert.ok(auth >= 0);
  assert.ok(remediation > auth);
  assert.match(cron, /remediation\.ok/);
});
