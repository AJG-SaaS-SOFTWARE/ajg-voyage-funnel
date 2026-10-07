import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/product-plan-label.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const module = { exports: {} };
new Function("require", "module", "exports", code)(() => ({}), module, module.exports);
const { productPlanLabel } = module.exports;

test("plan labels are localized from stable plan keys", () => {
  assert.equal(productPlanLabel("free", "fr"), "Gratuit");
  assert.equal(productPlanLabel("free", "en"), "Free");
  assert.equal(productPlanLabel("essential", "fr"), "Essentiel");
  assert.equal(productPlanLabel("essential", "en"), "Essential");
  assert.equal(productPlanLabel("growth", "fr"), "Growth");
  assert.equal(productPlanLabel("growth", "en"), "Growth");
});

test("customer plan surfaces no longer render persisted planName directly", () => {
  const plans = fs.readFileSync(new URL("../app/plans/page.tsx", import.meta.url), "utf8");
  const home = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(plans, /productPlanLabel\(current\.planKey, locale\)/);
  assert.doesNotMatch(plans, /current\.planName/);
  assert.match(home, /productPlanLabel\(planKey, locale\)/);
  assert.doesNotMatch(home, /resolvedPlanName|setPlanName|\bplanName\b/);
});
