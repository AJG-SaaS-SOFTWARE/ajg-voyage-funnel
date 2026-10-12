import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import * as crypto from "node:crypto";

function load(configuration, request) {
  const code = ts.transpileModule(fs.readFileSync(new URL("../lib/stripe-billing.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", "process", "fetch", code)(
    () => crypto, loaded, loaded.exports,
    { env: { STRIPE_RESTRICTED_KEY: "rk_test_synthetic", STRIPE_PORTAL_CONFIGURATION_ID: configuration } }, request
  );
  return loaded.exports;
}

test("missing portal configuration blocks before any Stripe request", async () => {
  for (const configuration of [undefined, "", "  "]) {
    let calls = 0;
    const billing = load(configuration, async () => { calls++; throw new Error("unexpected_request"); });
    await assert.rejects(billing.createStripePortalSession({ customerId: "cus_synthetic", returnUrl: "https://example.test/billing" }),
      { message: "stripe_portal_configuration_missing" });
    assert.equal(calls, 0);
  }
});

test("portal sessions always carry the exact configured ELTARA portal and return URL", async () => {
  let calls = 0;
  const billing = load("  bpc_eltara_synthetic  ", async (url, options) => {
    calls++;
    assert.equal(url, "https://api.stripe.com/v1/billing_portal/sessions");
    assert.equal(options.method, "POST");
    const form = new URLSearchParams(options.body);
    assert.equal(form.get("configuration"), "bpc_eltara_synthetic");
    assert.equal(form.get("customer"), "cus_synthetic");
    assert.equal(form.get("return_url"), "https://example.test/billing?siteId=synthetic");
    return { ok: true, json: async () => ({ id: "bps_synthetic", url: "https://billing.example.test/session" }) };
  });
  const session = await billing.createStripePortalSession({ customerId: "cus_synthetic", returnUrl: "https://example.test/billing?siteId=synthetic" });
  assert.equal(session.id, "bps_synthetic");
  assert.equal(calls, 1);
});
