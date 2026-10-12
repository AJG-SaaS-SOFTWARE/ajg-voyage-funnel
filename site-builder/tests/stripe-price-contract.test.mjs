import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const offers = [
  ["STRIPE_ESSENTIAL_MONTHLY_PRICE_ID", 1500, "month"],
  ["STRIPE_ESSENTIAL_ANNUAL_PRICE_ID", 15000, "year"],
  ["STRIPE_GROWTH_MONTHLY_PRICE_ID", 2900, "month"],
  ["STRIPE_GROWTH_ANNUAL_PRICE_ID", 29000, "year"],
  ["STRIPE_AI_LAUNCH_PRICE_ID", 4900, null],
];
function load(request) {
  const env = Object.fromEntries(offers.map(([name]) => [name, "price_" + name]));
  env.STRIPE_PORTAL_CONFIGURATION_ID = "bpc_synthetic";
  const code = ts.transpileModule(fs.readFileSync(new URL("../lib/stripe-readiness.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", "process", code)(
    () => ({ stripeRequest: request }), module, module.exports, { env });
  return module.exports;
}
function price([name, amount, interval]) {
  return { id: "price_" + name, active: true, currency: "eur", unit_amount: amount,
    type: interval ? "recurring" : "one_time", billing_scheme: "per_unit", transform_quantity: null,
    recurring: interval ? { interval, interval_count: 1, usage_type: "licensed" } : null,
    product: { active: true, metadata: { app: "ajg_site_builder" } } };
}
const portal = { active: true, metadata: { app: "ajg_site_builder" }, features: {
  payment_method_update: { enabled: true }, invoice_history: { enabled: true },
  subscription_cancel: { enabled: true, mode: "at_period_end" }, subscription_update: { enabled: true },
} };
function provider(mutate = value => value) {
  return async (path, options) => {
    assert.equal(options.method, "GET");
    if (path.includes("billing_portal")) return portal;
    const offer = offers.find(([name]) => path.endsWith("price_" + name));
    assert.ok(offer);
    assert.deepEqual(options.params, { expand: ["product"] });
    return mutate(price(offer), offer);
  };
}
test("all five catalogue offers pass the actual Stripe audit with fixed prices and single periods", async () => {
  const result = await load(provider()).auditStripeRuntime();
  assert.equal(result.length, 6);
  assert.equal(result.every(item => item.ok === true), true);
});
test("quarterly, multi-year, metered and incomplete recurring prices never pass as monthly or annual", async () => {
  for (const mutation of [
    p => { p.recurring.interval_count = 3; },
    p => { delete p.recurring.interval_count; },
    p => { p.recurring.interval_count = "1"; },
    p => { p.recurring.usage_type = "metered"; },
    p => { delete p.recurring.usage_type; },
  ]) {
    const result = await load(provider((p, offer) => { if (offer[2]) mutation(p); return p; })).auditStripeRuntime();
    assert.equal(result.slice(0, 4).every(item => item.ok === false), true);
    assert.equal(result[4].ok, true);
  }
});
test("wrong identity, tiered or transformed quantity prices fail even at the expected unit amount", async () => {
  for (const mutation of [
    p => { p.id = "price_other"; },
    p => { p.billing_scheme = "tiered"; },
    p => { p.transform_quantity = { divide_by: 10, round: "up" }; },
  ]) {
    const result = await load(provider(p => { mutation(p); return p; })).auditStripeRuntime();
    assert.equal(result.slice(0, 5).every(item => item.ok === false), true);
  }
});
test("invalid provider responses and read failures remain blockers with generic diagnostics", async () => {
  for (const request of [async () => null, async () => { throw new Error("private-provider-marker"); }]) {
    const result = await load(request).auditStripeRuntime();
    assert.equal(result.every(item => item.ok === false), true);
    assert.equal(JSON.stringify(result).includes("private-provider-marker"), false);
  }
});
