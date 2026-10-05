import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("production verifier checks a non-existent API route outside canonical redirect middleware", () => {
  const source = readFileSync("scripts/verify-deployment.mjs", "utf8");
  assert.match(source, /get\("\/api\/ci-route-that-does-not-exist", \[404\]\)/);
  assert.doesNotMatch(source, /get\("\/ci-route-that-does-not-exist", \[404\]\)/);
});
