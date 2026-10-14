import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const designSource = fs.readFileSync(new URL("../lib/site-design.ts", import.meta.url), "utf8");
const legalSource = fs.readFileSync(new URL("../lib/site-legal.ts", import.meta.url), "utf8");
const configSource = fs.readFileSync(new URL("../lib/site-config.ts", import.meta.url), "utf8");

function load(source, localRequire = require) {
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(localRequire, module, module.exports);
  return module.exports;
}

const design = load(designSource);
const legal = load(legalSource);
const config = load(configSource, (id) => {
  if (id === "./site-design") return design;
  if (id === "./site-legal") return legal;
  return require(id);
});

test("new ELTARA drafts start as independent generalist websites", () => {
  assert.equal(config.defaultSiteConfig.affiliation, "independent");
  assert.doesNotMatch(config.defaultSiteConfig.heroTitle, /MWR|Travel Advantage/i);
  assert.doesNotMatch(config.defaultSiteConfig.heroSubtitle, /MWR|Travel Advantage/i);
});

test("new drafts contain no inserted promotional content or dedicated affiliation profile", () => {
  assert.equal(config.defaultSiteConfig.heroTitle, "");
  assert.equal(config.defaultSiteConfig.heroSubtitle, "");
  assert.equal(config.defaultSiteConfig.bookingLabel, "Nous contacter");
  assert.doesNotMatch(configSource, /MWR|Travel Advantage|siteDisclaimer/);
});
