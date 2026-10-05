import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync("app/page.tsx", "utf8");
const css = readFileSync("app/globals.css", "utf8");

test("ELTARA home hero uses the balanced hierarchy and dedicated language control", () => {
  assert.match(home, /home-hero-meta/);
  assert.match(css, /ELTARA home hero balance/);
  assert.match(css, /\.premium-home \.premium-intro h1\{/);
  assert.match(css, /font-size:clamp\(3\.1rem,4\.65vw,5\.65rem\)/);
  assert.match(css, /color:#1a2b3d/);
});

test("home language switch is a branded segmented control instead of browser-default buttons", () => {
  assert.match(css, /\.premium-home \.language-switch\.compact\{/);
  assert.match(css, /border-radius:999px/);
  assert.match(css, /linear-gradient\(135deg,var\(--eltara-violet/);
  assert.match(css, /button:focus-visible/);
});

test("home hero keeps explicit mobile scaling", () => {
  assert.match(css, /@media\(max-width:720px\)[\s\S]*?\.premium-home \.premium-intro h1/);
  assert.match(css, /font-size:clamp\(2\.65rem,12vw,4\.15rem\)/);
});
