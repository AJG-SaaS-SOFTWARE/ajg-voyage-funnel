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
  assert.match(eslintConfig, /FlatCompat/);
  assert.match(eslintConfig, /next\/core-web-vitals/);
  assert.doesNotMatch(eslintConfig, /next\/typescript/);
  assert.match(ci, /npm run lint/);
});

test("ELTARA scopes the Node-test exception instead of weakening product lint rules", () => {
  assert.match(eslintConfig, /tests\/\*\*\/\*\.\{js,mjs,cjs,ts,tsx\}/);
  assert.match(eslintConfig, /@next\/next\/no-assign-module-variable/);
  assert.doesNotMatch(eslintConfig, /react\/no-unescaped-entities.*off/);
});

test("ELTARA pins the lint toolchain instead of relying on transient npx installs", () => {
  assert.equal(packageJson.devDependencies?.["@eslint/eslintrc"], "3.3.7");
  assert.match(packageJson.devDependencies?.eslint || "", /^9\./);
  assert.equal(packageJson.devDependencies?.["eslint-config-next"], packageJson.dependencies.next);
});

test("ELTARA corrective writes are isolated to the post-baseline lint_fix mode", () => {
  const diagnose = corrective.split("\n  diagnose:")[1].split("\n  lint_fix:")[0];
  const lintFix = corrective.split("\n  lint_fix:")[1];
  assert.match(diagnose, /contents: read/);
  assert.doesNotMatch(diagnose, /contents: write/);
  assert.match(lintFix, /contents: write/);
  assert.match(lintFix, /--fix-dry-run/);
  assert.match(lintFix, /package-lock\.json/);
  assert.doesNotMatch(lintFix, /npm install(?:\s|$)/);
});
