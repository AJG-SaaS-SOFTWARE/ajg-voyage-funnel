import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../scripts/stripe-provider-lifecycle-e2e.mjs", import.meta.url), "utf8").replace(/^import .*\n/, "");

async function runScenario(attachmentOverride) {
  let state = "active";
  let cleanup = false;
  let result;
  const assigned = [];
  const response = (data) => ({ ok: true, json: async () => data });
  const context = {
    URLSearchParams,
    process: { env: { ELTARA_E2E_BASE_URL: "https://fixture.invalid", AJG_RELEASE_E2E_TOKEN: "fixture", STRIPE_PROVIDER_E2E_KEY: "rk_test_fixture" } },
    console: { log: (value) => { result = JSON.parse(value); }, error: () => {} },
    verifyProviderInvoiceFooter: () => ({ invoiceFooterValidated: true }),
    providerE2ECustomerParams: () => ({}),
    fetch: async (url, options) => {
      if (url.startsWith("https://fixture.invalid")) {
        const body = JSON.parse(options.body);
        if (body.action === "provision") return response({ attemptId: "attempt", ownerId: "owner", siteId: "site", growthMonthlyPriceId: "price_fixture", sandbox: true, checkoutEnabled: false });
        if (body.action === "cleanup") { cleanup = true; return response({}); }
        return response({ subscription: { provider: "stripe", providerCustomerId: "cus_fixture", providerSubscriptionId: "sub_fixture", providerPriceId: "price_fixture", status: state === "canceled" ? "canceled" : "active", firstPaymentConfirmed: true }, billing: { state, hasFailure: state === "grace" } });
      }
      const path = new URL(url).pathname.replace("/v1", "");
      const params = new URLSearchParams(options.body);
      if (path === "/test_helpers/test_clocks" && options.method === "POST") return response({ id: "clock_fixture", livemode: false });
      if (path === "/customers" && options.method === "POST") return response({ id: "cus_fixture", livemode: false });
      if (path.endsWith("/attach")) {
        const id = path.includes("chargeCustomerFail") ? "pm_failure_fixture" : "pm_success_fixture";
        return response({ id, customer: "cus_fixture", livemode: false, ...attachmentOverride });
      }
      const pm = params.get("default_payment_method") || params.get("invoice_settings[default_payment_method]");
      if (pm) { assert.ok(["pm_success_fixture", "pm_failure_fixture"].includes(pm), "must use the attached object ID, never its test alias"); assigned.push(pm); }
      if (path === "/subscriptions") return response({ id: "sub_fixture", livemode: false });
      if (path.endsWith("/advance")) { state = "grace"; return response({}); }
      if (path === "/test_helpers/test_clocks/clock_fixture" && options.method === "GET") return response({ status: "ready" });
      if (path === "/invoices") return response({ data: [{ id: "in_fixture", status: state === "grace" ? "open" : "paid", subscription: "sub_fixture" }] });
      if (path.endsWith("/pay")) { state = "active"; return response({}); }
      if (path === "/subscriptions/sub_fixture" && options.method === "DELETE") state = "canceled";
      return response({});
    }
  };
  let error;
  try { await vm.runInNewContext("(async () => {\n" + source + "\n})()", context); } catch (caught) { error = caught; }
  return { error, result, cleanup, assigned };
}

test("provider lifecycle reuses concrete attached IDs through payment, failure and recovery", async () => {
  const run = await runScenario();
  assert.equal(run.error, undefined);
  assert.equal(run.result.recovery, true);
  assert.equal(run.result.cancellation, true);
  assert.equal(run.result.cleanupOk, true);
  assert.equal(run.cleanup, true);
  assert.deepEqual(run.assigned, ["pm_success_fixture", "pm_success_fixture", "pm_failure_fixture", "pm_failure_fixture", "pm_success_fixture", "pm_success_fixture"]);
});

for (const [label, override] of [
  ["missing ID", { id: undefined }],
  ["test alias", { id: "pm_card_visa" }],
  ["wrong customer", { customer: "cus_other" }],
  ["live object", { livemode: true }]
]) {
  test("provider lifecycle rejects " + label + " and cleans up", async () => {
    const run = await runScenario(override);
    assert.equal(run.error?.message, "provider_billing_attached_payment_method_invalid");
    assert.equal(run.cleanup, true);
    assert.equal(run.assigned.length, 0);
    assert.equal(run.result, undefined);
  });
}
