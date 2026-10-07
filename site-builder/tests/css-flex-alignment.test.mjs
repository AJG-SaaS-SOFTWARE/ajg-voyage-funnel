import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync("app/globals.css", "utf8");

test("admin beta mission summary uses cross-browser flex alignment", () => {
  assert.match(
    css,
    /\.admin-beta-mission-summary-head\{display:flex;justify-content:space-between;align-items:flex-end;gap:18px\}/
  );
  assert.doesNotMatch(
    css,
    /\.admin-beta-mission-summary-head\{[^}]*align-items:end/
  );
  assert.match(
    css,
    /@media\(max-width:620px\)\{\.admin-beta-mission-summary-head\{align-items:flex-start;flex-direction:column\}/
  );
});
