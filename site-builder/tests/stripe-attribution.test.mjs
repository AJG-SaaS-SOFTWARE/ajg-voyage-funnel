import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

test("Stripe Checkout and subscriptions carry AJG Site Builder attribution metadata", () => {
  const source = fs.readFileSync(new URL("../lib/stripe-billing.ts", import.meta.url), "utf8");

  const matches = source.match(/app:\s*"ajg_site_builder"/g) || [];
  assert.ok(matches.length >= 3, "checkout, subscription_data and one-time checkout must all be tagged");

  assert.match(source, /subscription_data:[\s\S]*app:\s*"ajg_site_builder"/);
  assert.match(source, /purchase_type:\s*"ai_launch"[\s\S]*commercial_market:\s*"b2b"/);
});
