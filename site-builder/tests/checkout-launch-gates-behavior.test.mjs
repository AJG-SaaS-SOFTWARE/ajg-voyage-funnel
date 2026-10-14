import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const code = ts.transpileModule(fs.readFileSync(new URL("../app/api/billing/checkout/route.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

test("Checkout refuses unauthorized, closed and unready launches before payment effects", async () => {
  for (const [authenticated, enabled, expectedCode, expectedStatus] of [
    [false, "true", undefined, 401],
    [true, "false", "checkout_disabled", 503],
    [true, "true", "commercial_readiness_blocked", 503]
  ]) {
    let reads = 0;
    let audits = 0;
    let effects = 0;
    const forbidden = () => { effects++; throw new Error("unexpected payment effect"); };
    const dependencies = {
      "next/server": { NextResponse: { json: (body, options) => Response.json(body, options) } },
      "../../../../lib/server-billing": { billingUserContext: async () => authenticated ? { userId: "synthetic-user" } : null, billingServiceClient: forbidden, ownedBillingSite: forbidden, billingAppUrl: forbidden },
      "../../../../lib/stripe-billing": { createStripeOneTimeCheckout: forbidden, createStripeSubscriptionCheckout: forbidden },
      "../../../../lib/server-locale": { requestProductLocale: () => "fr", localize: (_, fr) => fr },
      "../../../../lib/commercial-checkout-readiness": { commercialCheckoutReadiness: async () => { audits++; return { ok: false, reasons: ["internal-private-marker"], stripeAudit: [] }; } },
      "../../../../lib/stripe-readiness": { auditAiLaunchActiveClientPrice: forbidden }
    };
    const module = { exports: {} };
    new Function("require", "module", "exports", "process", "console", code)(name => {
      assert.ok(name in dependencies, name); return dependencies[name];
    }, module, module.exports, { env: { AJG_BILLING_CHECKOUT_ENABLED: enabled } }, { error() {} });
    const response = await module.exports.POST({ headers: new Headers(), json() { reads++; return {}; } });
    assert.equal(response.status, expectedStatus);
    const body = await response.json();
    assert.equal(body.code, expectedCode);
    assert.equal(JSON.stringify(body).includes("internal-private-marker"), false);
    assert.equal(effects, 0);
    assert.equal(reads, 0);
    assert.equal(audits, authenticated && enabled === "true" ? 1 : 0);
  }
});
