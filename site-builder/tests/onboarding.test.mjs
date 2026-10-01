import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function loadTs(path) {
  const source = fs.readFileSync(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(require, module, module.exports);
  return module.exports;
}

const siteConfigModule = loadTs("../lib/site-config.ts");
const { defaultSiteConfig } = siteConfigModule;

// onboarding imports site-config + site-legal; use a small CommonJS loader cache through transpiled files.
const legalSource = fs.readFileSync(new URL("../lib/site-legal.ts", import.meta.url), "utf8");
const legalCode = ts.transpileModule(legalSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const legalModule = { exports: {} };
new Function("require", "module", "exports", legalCode)(require, legalModule, legalModule.exports);

const onboardingSource = fs.readFileSync(new URL("../lib/onboarding.ts", import.meta.url), "utf8");
const onboardingCode = ts.transpileModule(onboardingSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const onboardingModule = { exports: {} };
const localRequire = (id) => {
  if (id === "./site-legal") return legalModule.exports;
  if (id === "./site-config") return siteConfigModule;
  return require(id);
};
new Function("require", "module", "exports", onboardingCode)(localRequire, onboardingModule, onboardingModule.exports);
const { deriveOnboardingProgress } = onboardingModule.exports;

function completeLegal() {
  return {
    ...defaultSiteConfig.legal,
    address: "1 rue Exemple",
    email: "hello@example.com",
    phone: "0102030405",
    siren: "123456789",
    confirmedAccuracy: true
  };
}

test("new draft resumes at identity", () => {
  const result = deriveOnboardingProgress(defaultSiteConfig, "draft");
  assert.equal(result.percent, 0);
  assert.equal(result.nextStep, "identity");
  assert.equal(result.done, false);
});

test("completed identity resumes at message", () => {
  const config = {
    ...defaultSiteConfig,
    firstName: "Alex",
    lastName: "Martin",
    brandName: "Alex Martin",
    slug: "alex-martin"
  };
  const result = deriveOnboardingProgress(config, "draft");
  assert.equal(result.percent, 25);
  assert.equal(result.nextStep, "story");
});

test("legal requirements are part of onboarding before publication", () => {
  const config = {
    ...defaultSiteConfig,
    firstName: "Alex",
    lastName: "Martin",
    brandName: "Alex Martin",
    slug: "alex-martin",
    heroTitle: "Un site professionnel",
    heroSubtitle: "Une présentation claire de mon activité professionnelle.",
    aboutText: "Je présente ici mon activité, mon approche et les services que je propose.",
    legal: completeLegal()
  };
  const result = deriveOnboardingProgress(config, "draft");
  assert.equal(result.percent, 75);
  assert.equal(result.nextStep, "review");
});

test("published complete website finishes onboarding", () => {
  const config = {
    ...defaultSiteConfig,
    firstName: "Alex",
    lastName: "Martin",
    brandName: "Alex Martin",
    slug: "alex-martin",
    heroTitle: "Un site professionnel",
    heroSubtitle: "Une présentation claire de mon activité professionnelle.",
    aboutText: "Je présente ici mon activité, mon approche et les services que je propose.",
    legal: completeLegal()
  };
  const result = deriveOnboardingProgress(config, "published");
  assert.equal(result.percent, 100);
  assert.equal(result.nextStep, null);
  assert.equal(result.done, true);
});
