import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../components/AccountShell.tsx", import.meta.url), "utf8");
const plans = fs.readFileSync(new URL("../app/plans/page.tsx", import.meta.url), "utf8");

test("customer account uses a dedicated premium workspace shell", () => {
  assert.match(shell, /className="account-workspace"/);
  assert.match(shell, /className="account-sidebar"/);
  assert.match(shell, /className="account-builder-shortcut"/);
  assert.match(shell, /comparer les offres/i);
  assert.match(css, /\.account-workspace\{[\s\S]*?grid-template-columns:220px minmax\(0,1fr\)/);
  assert.match(css, /\.account-sidebar\{[\s\S]*?position:sticky/);
});

test("account language controls use the shared segmented visual treatment", () => {
  assert.match(css, /\.account-topbar \.language-switch\.compact\{/);
  assert.match(css, /\.account-topbar \.language-switch\.compact button\.active\{/);
});

test("My plan page prioritizes current plan and compact usage metrics", () => {
  assert.match(plans, /account-plan-overview/);
  assert.match(plans, /account-metrics-grid/);
  assert.match(plans, /account-metric-card/);
  assert.match(plans, /account-offer-explainer/);
  assert.doesNotMatch(plans, /<progress /);
  assert.match(css, /\.account-metrics-grid\{[\s\S]*?repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /\.account-meter>span\{[\s\S]*?linear-gradient/);
});

test("premium account layout keeps a responsive single-column fallback", () => {
  assert.match(css, /@media\(max-width:1050px\)\{[\s\S]*?\.account-workspace\{grid-template-columns:1fr/);
  assert.match(css, /@media\(max-width:820px\)\{[\s\S]*?\.account-metrics-grid\{grid-template-columns:1fr/);
});
