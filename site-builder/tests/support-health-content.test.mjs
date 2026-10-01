import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../lib/support-health-server.ts", import.meta.url),
  "utf8"
);

test("Health Center loads site config and verifies both required storage buckets", () => {
  assert.match(source, /created_at,config/);
  assert.match(source, /contentHealthFromConfig\(site\.config\)/);
  assert.match(source, /getBucket\("site-media"\)/);
  assert.match(source, /getBucket\("site-private-media"\)/);
  assert.match(source, /safeStorageAvailability\(service\)/);
});

test("content health remains deterministic and does not fetch customer URLs", () => {
  assert.match(source, /invalidConfiguredLinks/);
  assert.match(source, /missingPublishableMedia/);
  assert.match(source, /galleryImageCount/);
  const helper = source.slice(source.indexOf("function contentHealthFromConfig"), source.indexOf("async function safeStorageAvailability"));
  assert.ok(!helper.includes("fetch("));
});
