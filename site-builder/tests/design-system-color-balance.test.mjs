import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const design = fs.readFileSync(new URL("../app/ajg-design-system.css", import.meta.url), "utf8");
const pricing = fs.readFileSync(new URL("../components/PricingPage.module.css", import.meta.url), "utf8");

test("ELTARA color balance preserves warm semantics alongside blue and AI violet", () => {
  assert.match(design, /--ajg-primary:#4E79D8/);
  assert.match(design, /--ajg-ai:#6f5bd5/);
  assert.match(design, /--ajg-warm:#c58a2c/);
  assert.match(design, /--ajg-warm-soft:#fff4df/);
});

test("Builder carries stronger color cues across header, path, guidance and editor chrome", () => {
  assert.match(design, /\.premium-builder-topbar::after/);
  assert.match(design, /\.premium-step-nav button\.active\{[\s\S]*?box-shadow:inset 3px 0 0 var\(--ajg-primary\)/);
  assert.match(design, /\.step-guidance-card\{[\s\S]*?box-shadow:inset 3px 0 0 rgba\(78,121,216,.55\)/);
  assert.match(design, /\.section-kicker>span\{[\s\S]*?background:var\(--ajg-primary-soft\)/);
  assert.match(design, /\.preview-panel-heading\{[\s\S]*?rgba\(111,91,213,.055\)/);
});

test("Dashboard and account surfaces use semantic accent families rather than random colors", () => {
  assert.match(design, /\.create-card\{[\s\S]*?rgba\(78,121,216,.105\)/);
  assert.match(design, /\.state-card\{[\s\S]*?rgba\(197,138,44,.105\)/);
  assert.match(design, /\.architecture-card\{[\s\S]*?rgba\(111,91,213,.10\)/);
  assert.match(design, /\.account-metric-card:nth-child\(1\),[\s\S]*?rgba\(111,91,213,.07\)/);
  assert.match(design, /\.account-metric-card:nth-child\(3\)\{[\s\S]*?rgba\(78,121,216,.08\)/);
  assert.match(design, /\.account-offer-explainer\{[\s\S]*?rgba\(197,138,44,.08\)/);
});

test("Primary CTAs stay dark enough for white text while becoming visually richer", () => {
  assert.match(design, /background:linear-gradient\(135deg,var\(--eltara-violet\) 0%,var\(--eltara-blue\) 62%,#43B8DE 100%\)/);
  assert.match(design, /background:linear-gradient\(135deg,var\(--eltara-indigo\) 0%,#426AC6 62%,#35A9D4 100%\)/);
});

test("Public pricing uses ELTARA blue and violet accents", () => {
  assert.match(pricing, /rgba\(78,121,216,.085\)/);
  assert.match(pricing, /rgba\(111,91,213,.05\)/);
  assert.match(pricing, /rgba\(111,91,213,.12\)/);
  assert.match(pricing, /rgba\(78,121,216,.11\)/);
});

test("customer website rendering remains outside the product color layer", () => {
  assert.doesNotMatch(design, /\.public-site/);
  assert.doesNotMatch(design, /\.site-preview/);
  assert.doesNotMatch(design, /\.published-page/);
});
