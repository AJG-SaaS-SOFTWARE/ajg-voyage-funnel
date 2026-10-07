import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("ELTARA production release fails on official-domain health without rolling back healthy code", () => {
  const workflow = readFileSync("../.github/workflows/site-builder-production.yml", "utf8");
  assert.match(workflow, /PRODUCTION_ALIAS: ajg-site-builder\.vercel\.app/);
  assert.match(workflow, /PUBLIC_DOMAIN: eltara\.ajgsolutionsgroup\.com/);
  assert.match(workflow, /Verify ELTARA public domain without rolling back code/);
  assert.match(workflow, /official domain is unhealthy/);
  assert.match(workflow, /https:\/\/\$PUBLIC_DOMAIN\/api\/health/);
  assert.match(workflow, /verify:deployment -- --url="https:\/\/\$PRODUCTION_ALIAS"/);
  assert.match(workflow, /Verify managed-domain HTTPS canary when available/);
  assert.match(workflow, /Managed-domain canary .*NXDOMAIN\/unresolvable/);
  assert.match(workflow, /external DNS must publish the ELTARA wildcard\/subdomain record/);
});
