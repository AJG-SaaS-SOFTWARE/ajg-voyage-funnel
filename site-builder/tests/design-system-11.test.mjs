import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const design = fs.readFileSync(new URL("../app/ajg-design-system.css", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const pricing = fs.readFileSync(new URL("../components/PricingPage.module.css", import.meta.url), "utf8");

test("AJG design system is loaded after legacy globals so it can safely override product UI", () => {
  const globalsIndex = layout.indexOf('import "./globals.css";');
  const designIndex = layout.indexOf('import "./ajg-design-system.css";');
  assert.ok(globalsIndex >= 0);
  assert.ok(designIndex > globalsIndex);
});

test("design system exposes a neutral canvas, a single brand accent and semantic colors", () => {
  assert.match(design, /--ajg-bg:#f6f6f3/);
  assert.match(design, /--ajg-surface:#ffffff/);
  assert.match(design, /--ajg-ink:#172c35/);
  assert.match(design, /--ajg-primary:#0b8f85/);
  assert.match(design, /--ajg-ai:#6f5bd5/);
  assert.match(design, /--ajg-success:#2f7c5b/);
  assert.match(design, /--ajg-warning:#a96c13/);
  assert.match(design, /--ajg-danger:#a84e44/);
});

test("main product surfaces share the same cards, controls and focus language", () => {
  assert.match(design, /\.premium-card,[\s\S]*?\.account-shell \.data-rights-panel,[\s\S]*?\.feedback-form/);
  assert.match(design, /\.premium-home \.button\.primary,[\s\S]*?\.account-shell \.button\.primary/);
  assert.match(design, /outline:3px solid var\(--ajg-focus\)/);
  assert.match(design, /\.premium-builder-shell :is\(input,textarea,select\)/);
});

test("AI is visually distinct without replacing AJG teal as the primary action color", () => {
  assert.match(design, /\.ai-field-assistant,\.module-ai-assistant/);
  assert.match(design, /\.ai-field-spark\{background:var\(--ajg-ai-soft\);color:var\(--ajg-ai\)\}/);
  assert.match(design, /\.account-metric-card:nth-child\(-n\+2\) \.account-metric-icon/);
  assert.match(design, /background:var\(--ajg-primary\);\n  color:#fff/);
});

test("customer-created websites remain outside the AJG product color override", () => {
  assert.doesNotMatch(design, /\.public-site/);
  assert.doesNotMatch(design, /\.site-preview/);
  assert.doesNotMatch(design, /\.published-page/);
});

test("public pricing uses the same neutral and semantic design tokens", () => {
  assert.match(pricing, /var\(--ajg-bg,#f6f6f3\)/);
  assert.match(pricing, /var\(--ajg-primary,#0b8f85\)/);
  assert.match(pricing, /var\(--ajg-ai-hover,#5945bd\)/);
  assert.match(pricing, /var\(--ajg-border/);
  assert.doesNotMatch(pricing, /#f5f1e9/);
  assert.doesNotMatch(pricing, /#57d4c9/);
});

test("responsive safeguards remain explicit for the refreshed product UI", () => {
  assert.match(design, /@media\(max-width:820px\)/);
  assert.match(design, /@media\(max-width:620px\)/);
  assert.match(pricing, /@media\(max-width:780px\)/);
  assert.match(pricing, /@media\(max-width:520px\)/);
});
