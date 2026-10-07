import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/product-format.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const module = { exports: {} };
new Function("require", "module", "exports", code)(() => ({}), module, module.exports);
const { formatProductNumber } = module.exports;

test("product number formatter follows the selected ELTARA locale", () => {
  assert.equal(formatProductNumber(12.5, "fr", 1, 1), "12,5");
  assert.equal(formatProductNumber(12.5, "en", 1, 1), "12.5");
  assert.equal(formatProductNumber(1234.5, "fr", 1, 1), "1 234,5");
  assert.equal(formatProductNumber(1234.5, "en", 1, 1), "1,234.5");
});

test("customer numeric surfaces use the shared locale-aware formatter", () => {
  const paths = [
    "../app/analytics/page.tsx",
    "../app/growth/page.tsx",
    "../app/plans/page.tsx",
    "../app/builder/page.tsx"
  ];
  for (const path of paths) {
    const content = fs.readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(content, /formatProductNumber/);
  }

  const analytics = fs.readFileSync(new URL("../app/analytics/page.tsx", import.meta.url), "utf8");
  const growth = fs.readFileSync(new URL("../app/growth/page.tsx", import.meta.url), "utf8");
  const builder = fs.readFileSync(new URL("../app/builder/page.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(analytics, /\.toFixed\(1\)/);
  assert.doesNotMatch(growth, /item\.value\.toFixed\(1\)/);
  assert.doesNotMatch(builder, /contrastRatio\([^\n]+\.toFixed\(1\)/);
});
