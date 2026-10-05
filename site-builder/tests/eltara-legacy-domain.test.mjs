import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const middleware = fs.readFileSync(
  new URL("../middleware.ts", import.meta.url),
  "utf8"
);

test("legacy public Builder alias permanently redirects to the ELTARA branded host", () => {
  assert.match(middleware, /legacyAppHostname="ajg-site-builder\.vercel\.app"/);
  assert.match(middleware, /url\.hostname=appHostname/);
  assert.match(middleware, /NextResponse\.redirect\(url,308\)/);
});

test("generic Vercel deployment URLs remain accepted for technical release checks", () => {
  assert.match(middleware, /hostname\.endsWith\("\.vercel\.app"\)/);
});
