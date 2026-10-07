import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const uptime = fs.readFileSync(
  new URL("../../.github/workflows/site-builder-uptime.yml", import.meta.url),
  "utf8"
);
const production = fs.readFileSync(
  new URL("../../.github/workflows/site-builder-production.yml", import.meta.url),
  "utf8"
);

function stepBlock(source, name, nextName) {
  const start = source.indexOf(`- name: ${name}`);
  assert.ok(start >= 0, `missing workflow step: ${name}`);
  const end = nextName ? source.indexOf(`- name: ${nextName}`, start + 1) : source.length;
  return source.slice(start, end >= 0 ? end : source.length);
}

test("official ELTARA domain is a hard uptime gate", () => {
  const block = stepBlock(
    uptime,
    "Check ELTARA public domain",
    "Check ELTARA published canary site"
  );
  assert.ok(block.includes("eltara.ajgsolutionsgroup.com/api/health"));
  assert.ok(block.includes("exit 1"));
  assert.ok(block.includes("::error::"));
  assert.ok(!block.includes("continue-on-error"));
  assert.ok(!block.includes("exit 0"));
});

test("controlled production release fails signal when official domain is unhealthy without invoking rollback there", () => {
  const block = stepBlock(
    production,
    "Verify ELTARA public domain without rolling back code",
    "Verify managed-domain HTTPS canary when available"
  );
  assert.ok(block.includes('https://$PUBLIC_DOMAIN/api/health'));
  assert.ok(block.includes("exit 1"));
  assert.ok(block.includes("::error::"));
  assert.ok(!block.includes("continue-on-error"));
  assert.ok(!block.includes("rollback/"));
});
