import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const design = fs.readFileSync(new URL("../app/ajg-design-system.css", import.meta.url), "utf8");

test("story cards visibly map to the ELTARA semantic palette", () => {
  assert.match(design, /\.premium-builder-shell \.content-library-card\{[\s\S]*?rgba\(111,91,213,.13\)/);
  assert.match(design, /\.premium-builder-shell \.architecture-editor-card\{[\s\S]*?rgba\(78,121,216,.13\)/);
  assert.match(design, /\.premium-builder-shell \.ai-architect-card,[\s\S]*?rgba\(111,91,213,.16\)/);
});

test("AI actions use violet while premium lock status stays amber", () => {
  assert.match(design, /\.premium-builder-shell \.ai-architect-card \.button\.primary\{[\s\S]*?#7462d9[\s\S]*?#5541b8/);
  assert.match(design, /\.premium-builder-shell \.ai-architect-card\.premium-feature-locked \.guided-writing-badge\{[\s\S]*?var\(--ajg-warm-soft\)/);
  assert.match(design, /\.premium-builder-shell \.ai-architect-card \.premium-feature-lock-note\{[\s\S]*?#fff8ea/);
});

test("builder navigation and preview chrome keep blue and violet orientation cues", () => {
  assert.match(design, /\.premium-builder-panel \.section-kicker::after\{[\s\S]*?rgba\(78,121,216,.28\)/);
  assert.match(design, /\.premium-builder-preview \.preview-panel-heading\{[\s\S]*?rgba\(111,91,213,.10\)/);
  assert.match(design, /\.premium-builder-preview \.preview-panel-note\{[\s\S]*?var\(--ajg-primary-soft\)/);
});

test("dashboard and account expose all three semantic accent families", () => {
  assert.match(design, /\.premium-home \.create-card\{[\s\S]*?rgba\(78,121,216,.58\)/);
  assert.match(design, /\.premium-home \.state-card\{[\s\S]*?rgba\(197,138,44,.58\)/);
  assert.match(design, /\.premium-home \.architecture-card\{[\s\S]*?rgba\(111,91,213,.58\)/);
  assert.match(design, /\.account-shell \.account-offer-explainer\{[\s\S]*?rgba\(197,138,44,.48\)/);
});

test("customer-created sites remain outside the semantic palette layer", () => {
  const layer = design.slice(design.indexOf("AJG Design System 1.3 — visible semantic palette"));
  assert.ok(layer.length > 0);
  assert.doesNotMatch(layer, /\.public-site/);
  assert.doesNotMatch(layer, /\.site-preview/);
  assert.doesNotMatch(layer, /\.published-page/);
});
