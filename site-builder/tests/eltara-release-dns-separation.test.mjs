import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("ELTARA production release does not rollback healthy code for external DNS propagation", () => {
  const workflow = readFileSync("../.github/workflows/site-builder-production.yml", "utf8");
  assert.match(workflow, /PRODUCTION_ALIAS: ajg-site-builder\.vercel\.app/);
  assert.match(workflow, /PUBLIC_DOMAIN: eltara\.ajgsolutionsgroup\.com/);
  assert.match(workflow, /Verify ELTARA public domain without rolling back code/);
  assert.match(workflow, /continue-on-error: true/);
  assert.match(workflow, /DNS must be completed at the external DNS provider/);
  assert.match(workflow, /verify:deployment -- --url="https:\/\/\$PRODUCTION_ALIAS"/);
});
