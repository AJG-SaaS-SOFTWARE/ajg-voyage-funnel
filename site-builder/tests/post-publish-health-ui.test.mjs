import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const builder = fs.readFileSync(
  new URL("../app/builder/page.tsx", import.meta.url),
  "utf8"
);

test("successful cloud publishing launches a non-blocking final health diagnostic", () => {
  assert.match(builder, /runPostPublishHealth\(publishedSiteId, publishAccessToken\)/);
  assert.match(builder, /\/api\/support\/health\?siteId=/);
  assert.match(builder, /void runPostPublishHealth/);
});

test("final diagnostic exposes actionable Health Center navigation", () => {
  assert.match(builder, /DIAGNOSTIC APRÈS PUBLICATION/);
  assert.match(builder, /Corriger avec le Health Center/);
  assert.match(builder, /Relancer le diagnostic/);
  assert.match(builder, /postPublishHealth\.checks\.map/);
});
