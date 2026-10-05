import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("deployment verification accepts only canonical ELTARA redirects for public routes", () => {
  const source = readFileSync("scripts/verify-deployment.mjs", "utf8");
  assert.match(source, /getPublicRoute/);
  assert.match(source, /\[200, 307, 308\]/);
  assert.match(source, /redirected\.hostname !== "eltara\.ajgsolutionsgroup\.com"/);
  assert.match(source, /redirected\.pathname !== path/);
  assert.match(source, /getPublicRoute\("\/login"\)/);
  assert.match(source, /getPublicRoute\("\/plans"\)/);
  assert.match(source, /getPublicRoute\("\/billing"\)/);
});
