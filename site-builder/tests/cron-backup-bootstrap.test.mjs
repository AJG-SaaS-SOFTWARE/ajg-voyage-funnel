import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync(
  new URL("../../.github/workflows/site-builder-production.yml", import.meta.url),
  "utf8"
);

test("release creates CRON_SECRET only when production does not already have one", () => {
  assert.ok(workflow.includes("Ensure production cron secret"));
  assert.ok(workflow.includes('item?.key==="CRON_SECRET"'));
  assert.ok(workflow.includes('crypto.randomBytes(32).toString("base64url")'));
  assert.ok(workflow.includes('type: "sensitive"'));
  assert.ok(workflow.includes('target: ["production"]'));
  assert.ok(workflow.includes("CRON_SECRET already exists; no rotation performed"));
  assert.ok(!workflow.includes("/env?upsert=true"));
});

test("release can bootstrap the first off-provider backup through the deployed cron", () => {
  assert.ok(workflow.includes("Bootstrap first off-provider media backup when needed"));
  assert.ok(workflow.includes("continue-on-error: true"));
  assert.ok(workflow.includes("/api/health/storage-backup"));
  assert.ok(workflow.includes("vercel@60.1.3 crons run /api/cron/storage-backup"));
  assert.ok(workflow.includes("no completed media backup became visible"));
});

test("bootstrap skips backup when already initialized", () => {
  assert.ok(workflow.includes('if [ -n "$LAST_COMPLETED" ]'));
  assert.ok(workflow.includes("Media backup already initialized at $LAST_COMPLETED; bootstrap skipped."));
});
