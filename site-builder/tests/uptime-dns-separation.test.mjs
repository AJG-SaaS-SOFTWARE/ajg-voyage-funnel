import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("ELTARA uptime hard-gates the official domain while keeping the branded canary tolerant", () => {
  const workflow = readFileSync("../.github/workflows/site-builder-uptime.yml", "utf8");
  assert.match(workflow, /https:\/\/ajg-site-builder\.vercel\.app\/api\/health/);
  assert.match(workflow, /Check ELTARA public domain/);
  assert.match(workflow, /eltara\.ajgsolutionsgroup\.com is not resolvable/);
  assert.match(workflow, /https:\/\/eltara\.ajgsolutionsgroup\.com\/api\/health/);
  assert.match(workflow, /Check ELTARA published canary site/);
  assert.match(workflow, /continue-on-error: true/);
  assert.match(workflow, /ELTARA branded canary DNS is not ready yet/);
  assert.match(workflow, /https:\/\/test-julien\.voyage\.ajgsolutionsgroup\.com/);
});
