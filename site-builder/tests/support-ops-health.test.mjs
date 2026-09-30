import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(
  new URL("../app/api/health/support/route.ts", import.meta.url),
  "utf8"
);

test("support ops signal exposes no ticket content or customer identifiers", () => {
  assert.match(route, /\.select\("severity,status,created_at"\)/);
  assert.doesNotMatch(route, /\.select\([^)]*message/);
  assert.doesNotMatch(route, /\.select\([^)]*user_id/);
  assert.doesNotMatch(route, /\.select\([^)]*subject/);
});

test("only tickets that require AJG are included in the operations signal", () => {
  assert.match(route, /\.in\("status", \["new", "diagnosed", "in_progress"\]\)/);
  assert.doesNotMatch(route, /waiting_customer.*\.in/);
});

test("support health has deterministic escalation thresholds", () => {
  assert.match(route, /ticket\.severity === "critical"/);
  assert.match(route, /ticket\.severity === "high" && ageHours >= 24/);
  assert.match(route, /ageHours >= 72/);
  assert.match(route, /"Cache-Control": "no-store, max-age=0"/);
});
