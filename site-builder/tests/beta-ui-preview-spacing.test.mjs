import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const modules = fs.readFileSync(new URL("../components/ModulesEditor.tsx", import.meta.url), "utf8");
const architecture = fs.readFileSync(new URL("../components/ArchitectureEditor.tsx", import.meta.url), "utf8");
const builder = fs.readFileSync(new URL("../app/builder/page.tsx", import.meta.url), "utf8");

test("premium step labels override legacy circular span sizing", () => {
  assert.match(css, /\.premium-step-nav button \.step-label\{[\s\S]*?width:auto/);
  assert.match(css, /\.premium-step-nav button\.active \.step-label,[\s\S]*?background:transparent/);
  assert.match(css, /word-break:normal/);
});

test("live preview has an independent scroll area on desktop and simulated mobile", () => {
  assert.match(css, /\.preview-device-frame\{[\s\S]*?overflow:auto/);
  assert.match(css, /overscroll-behavior:contain/);
  assert.match(css, /\.preview-device-frame\.is-mobile\{[\s\S]*?max-height:/);
  assert.match(css, /\.preview-device-frame \.device-dots\{[\s\S]*?position:sticky/);
});

test("add controls and optional-module spacing are compact", () => {
  assert.match(css, /\.content-library-actions \.button,[\s\S]*?min-height:34px/);
  assert.match(css, /\.modules-editor>\.module-toggle-card\{\s*margin:8px 0/);
  assert.match(css, /\.module-toggle-card>\.module-fields\{\s*padding:14px 16px 16px/);
  assert.equal(
    (modules.match(/className="button secondary" disabled=\{modules\.(?:faq|testimonials|figures|benefits)\./g) || []).length,
    4
  );
  assert.doesNotMatch(
    modules,
    /className="secondary" disabled=\{modules\.(?:faq|testimonials|figures|benefits)\./
  );
});

test("UI explains the relationship between site pages and homepage sections", () => {
  assert.match(modules, /architectureMode: "single" \| "multi"/);
  assert.match(modules, /Cet ordre organise les rubriques de la page d’accueil/);
  assert.match(architecture, /Ici vous organisez les pages et la navigation/);
  assert.match(builder, /architectureMode=\{config\.architecture\.mode\}/);
});
