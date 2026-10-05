import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("ELTARA uptime keeps core app health independent from branded DNS", () => {
  const workflow = readFileSync("../.github/workflows/site-builder-uptime.yml", "utf8");
  assert.match(workflow, /https:\/\/ajg-site-builder\.vercel\.app\/api\/health/);
  assert.match(workflow, /Check ELTARA public domain/);
  assert.match(workflow, /continue-on-error: true/);
  assert.match(workflow, /is not resolvable yet/);
  assert.match(workflow, /https:\/\/test-julien\.voyage\.ajgsolutionsgroup\.com/);
});
