import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const eslintConfig = readFileSync(
  new URL("../eslint.config.mjs", import.meta.url),
  "utf8",
);
const ci = readFileSync(
  new URL("../../.github/workflows/site-builder-ci.yml", import.meta.url),
  "utf8",
);
const corrective = readFileSync(
  new URL("../../.github/workflows/ajg-corrective-diagnostics.yml", import.meta.url),
  "utf8",
);

test("ELTARA exposes ESLint as a first-class CI gate", () => {
  assert.equal(packageJson.scripts.lint, "eslint .");
  assert.match(eslintConfig, /eslint-config-next\/core-web-vitals/);
  assert.match(ci, /npm run lint/);
});

test("ELTARA pins the lint toolchain instead of relying on transient npx installs", () => {
  assert.match(packageJson.devDependencies?.eslint || "", /^9\./);
  assert.equal(packageJson.devDependencies?.["eslint-config-next"], packageJson.dependencies.next);
});

test("ELTARA corrective diagnostics remain read-only until the lint baseline is proven", () => {
  assert.match(corrective, /contents: read/);
  assert.doesNotMatch(corrective, /contents: write/);
  assert.doesNotMatch(corrective, /npm install/);
  assert.doesNotMatch(corrective, /git push/);
});
