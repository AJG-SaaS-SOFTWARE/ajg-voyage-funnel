import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const workflow = fs.readFileSync(
  new URL("../../.github/workflows/eltara-storage-backup-watchdog.yml", import.meta.url),
  "utf8",
);

test("backup watchdog independently verifies ELTARA backup freshness", () => {
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /10 \*\/6 \* \* \*/);
  assert.match(workflow, /api\/health\/storage-backup/);
  assert.match(workflow, /ageHours >= 36/);
});

test("backup watchdog only triggers the guarded existing cron when stale", () => {
  assert.match(workflow, /needs_recovery == 'true'/);
  assert.match(workflow, /vercel@60\.1\.3 crons run \/api\/cron\/storage-backup/);
  assert.match(workflow, /PREVIOUS_COMPLETED/);
  assert.match(workflow, /NEW_COMPLETED.*PREVIOUS_COMPLETED/s);
  assert.doesNotMatch(workflow, /vercel deploy/);
  assert.doesNotMatch(workflow, /git push/);
});
