import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(
  new URL("../app/api/support/health/route.ts", import.meta.url),
  "utf8"
);

test("post-publish health endpoint authenticates before privileged diagnosis", () => {
  assert.match(route, /auth\.getUser\(token\)/);
  assert.match(route, /diagnoseSupportHealth\(service, user\.id, siteId\)/);
  assert.match(route, /health\.siteId !== siteId/);
});

test("post-publish health endpoint never accepts a public hostname", () => {
  assert.ok(!route.includes("hostname"));
  assert.ok(!route.includes("fetch("));
  assert.match(route, /Cache-Control": "private, no-store"/);
});
