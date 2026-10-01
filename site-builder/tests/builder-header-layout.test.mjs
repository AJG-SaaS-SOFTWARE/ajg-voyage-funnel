import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const builder = fs.readFileSync(new URL("../app/builder/page.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("builder header actions use a dedicated homogeneous control class", () => {
  assert.equal((builder.match(/builder-header-action/g) || []).length, 4);
  assert.match(builder, /builder-header-utility/);
  assert.match(builder, /builder-header-status/);
  assert.match(css, /\.builder-header-action\{[^}]*width:116px/);
  assert.match(css, /\.builder-header-utility,[\s\S]*?\.account-button\{[\s\S]*?min-height:40px/);
  assert.match(css, /white-space:nowrap/);
});

test("language switch is a single compact horizontal control in the builder header", () => {
  assert.match(css, /\.premium-topbar-account \.language-switch\.compact\{/);
  assert.match(css, /display:inline-flex/);
  assert.match(css, /height:40px/);
});

test("long sidebar step labels expand instead of overlapping the next step", () => {
  assert.match(css, /\.premium-step-nav button\{[\s\S]*?align-items:flex-start/);
  assert.match(css, /\.step-label b\{[\s\S]*?line-height:1\.18/);
  assert.match(css, /\.step-label small\{[\s\S]*?line-height:1\.28/);
  assert.match(css, /overflow-wrap:anywhere/);
});
