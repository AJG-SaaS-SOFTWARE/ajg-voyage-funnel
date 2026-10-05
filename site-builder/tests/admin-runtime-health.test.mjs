import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("app/api/admin/support/route.ts", "utf8");
const page = readFileSync("app/admin/support/page.tsx", "utf8");
const probe = readFileSync("lib/vercel-runtime-health.ts", "utf8");

test("admin support includes bounded Vercel runtime health", () => {
  assert.match(route, /getRecentRuntimeHealth/);
  assert.match(route, /runtimeHealth\.status/);
  assert.match(page, /runtime · erreurs\/5xx/);
});

test("runtime probe is server-only, bounded and never exposes log messages", () => {
  assert.match(probe, /MAX_BYTES = 128 \* 1024/);
  assert.match(probe, /MAX_ROWS = 500/);
  assert.match(probe, /TIMEOUT_MS = 3500/);
  assert.match(probe, /runtime-logs/);
  assert.doesNotMatch(page, /messageTruncated|requestPath|requestMethod/);
  assert.doesNotMatch(route, /runtimeHealth\.message/);
});
