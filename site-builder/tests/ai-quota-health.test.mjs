import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../lib/ai-quota-health.ts", import.meta.url), "utf8");

test("AI quota health reads the same ledgers enforced by runtime admission", () => {
  assert.match(source, /from\("ai_usage_events"\)/);
  assert.match(source, /from\("site_ai_heavy_usage"\)/);
  assert.match(source, /from\("site_ai_launch_entitlements"\)/);
  assert.match(source, /from\("subscription_plans"\)/);
  assert.match(source, /from\("beta_access_grants"\)/);
});

test("AI quota health keeps standard usage account-scoped and launch usage site-scoped", () => {
  assert.match(source, /from\("ai_usage_events"\)[\s\S]*?eq\("user_id", userId\)/);
  assert.match(source, /from\("site_ai_heavy_usage"\)[\s\S]*?eq\("owner_id", userId\)/);
  assert.match(source, /from\("site_ai_launch_entitlements"\)[\s\S]*?eq\("site_id", siteId\)[\s\S]*?eq\("owner_id", userId\)/);
});

test("beta heavy quota preserves the bounded 30-operation policy", () => {
  assert.match(source, /betaActive\s*\?\s*30/);
});
