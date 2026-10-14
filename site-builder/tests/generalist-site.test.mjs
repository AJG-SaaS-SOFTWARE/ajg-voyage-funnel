import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const cache = new Map();
function load(path) {
  if (cache.has(path)) return cache.get(path);
  const file = new URL(`../${path}.ts`, import.meta.url);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(name => name.startsWith("./")
    ? load(`lib/${name.slice(2)}`) : require(name), module, module.exports);
  cache.set(path, module.exports); return module.exports;
}
const { defaultSiteConfig } = load("lib/site-config");
const { normalizeSiteDesign } = load("lib/site-design");

function render(name, config) {
  const source = fs.readFileSync(new URL(`../components/${name}.tsx`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX
  }}).outputText;
  const jsx = (type, props) => ({ type, props });
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(name => {
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name.startsWith("../lib/")) return load(name.slice(3));
    if (name.startsWith("./") || name === "next/link") return { default: "stub" };
    throw new Error(`Unexpected dependency ${name}`);
  }, module, module.exports);
  return JSON.stringify(module.exports.default({ config, siteId: "synthetic" }));
}

test("new sites start without an industry, affiliation, headline or inserted brand", () => {
  assert.equal(defaultSiteConfig.affiliation, "independent");
  assert.equal(defaultSiteConfig.heroTitle, "");
  assert.equal(defaultSiteConfig.heroSubtitle, "");
  assert.doesNotMatch(JSON.stringify(defaultSiteConfig), /mwr|travel advantage/i);
});
test("legacy logo flags are discarded by design normalization", () => {
  const design = normalizeSiteDesign({ showMwrLogo: true, showTravelAdvantageLogo: true });
  assert.equal("showMwrLogo" in design, false);
  assert.equal("showTravelAdvantageLogo" in design, false);
});
test("old affiliations cannot inject product-supplied brand marks or notices into either renderer", () => {
  for (const name of ["PublishedSite", "SitePreview"]) {
    for (const language of ["fr", "en"]) {
      const config = { ...defaultSiteConfig, affiliation: "mwr", language,
        design: { ...defaultSiteConfig.design, showMwrLogo: true, showTravelAdvantageLogo: true } };
      assert.doesNotMatch(render(name, config), /mwr|travel.?advantage|another way to travel|autre façon de voyager/i);
    }
  }
});
test("customer-entered brands remain ordinary content instead of being blocked", () => {
  const config = { ...defaultSiteConfig, heroTitle: "MWR Life et Travel Advantage", brandName: "Mon activité" };
  assert.match(render("PublishedSite", config), /MWR Life et Travel Advantage/);
});
