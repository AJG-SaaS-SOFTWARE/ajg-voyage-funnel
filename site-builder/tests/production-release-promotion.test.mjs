import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync(
  new URL("../../.github/workflows/site-builder-production.yml", import.meta.url),
  "utf8"
);

test("production release explicitly promotes the built Vercel artifact", () => {
  assert.ok(workflow.includes("/v10/projects/$VERCEL_PROJECT_ID/promote/$DEPLOYMENT_ID"));
  assert.ok(workflow.includes("--request POST"));
  assert.ok(workflow.includes("Production alias did not move to $DEPLOYMENT_ID"));
});

test("production release still keeps rollback verification after promotion", () => {
  const promote = workflow.indexOf("/v10/projects/$VERCEL_PROJECT_ID/promote/$DEPLOYMENT_ID");
  const verify = workflow.indexOf("- name: Verify live production or rollback");
  const rollback = workflow.indexOf("/rollback/$PREVIOUS_DEPLOYMENT_ID");
  assert.ok(promote >= 0);
  assert.ok(verify > promote);
  assert.ok(rollback > verify);
});


test("HTTP 409 is accepted only through alias verification", () => {
  assert.ok(workflow.includes('if [ "$PROMOTE_CODE" -eq 409 ]; then'));
  const conflict = workflow.indexOf('if [ "$PROMOTE_CODE" -eq 409 ]; then');
  const aliasCheck = workflow.indexOf('if [ "$ALIAS_DEPLOYMENT_ID" = "$DEPLOYMENT_ID" ]');
  const finalFailure = workflow.indexOf('Production alias did not move to $DEPLOYMENT_ID');
  assert.ok(aliasCheck > conflict);
  assert.ok(finalFailure > aliasCheck);
});
