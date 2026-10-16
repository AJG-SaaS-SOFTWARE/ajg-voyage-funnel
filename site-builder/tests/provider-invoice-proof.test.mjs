import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { verifyProviderInvoiceFooter, FRANCHISE_INVOICE_FOOTER } from "../scripts/provider-invoice-proof.mjs";

const attribution = { customerId: "cus_synthetic", subscriptionId: "sub_synthetic" };
const invoice = { id: "in_synthetic", livemode: false, customer: "cus_synthetic", parent: { subscription_details: { subscription: "sub_synthetic" } }, status: "paid", amount_paid: 2900, footer: FRANCHISE_INVOICE_FOOTER };

test("invoice footer proof requires a paid sandbox invoice attributed to this fixture", () => {
  assert.equal(verifyProviderInvoiceFooter(invoice, attribution).invoiceFooterValidated, true);
  for (const patch of [
    { livemode: true }, { customer: "cus_other" }, { parent: null }, { id: null },
    { status: "open" }, { status: "void" }, { amount_paid: 0 }, { amount_paid: "2900" },
    { footer: null }, { footer: "Other footer" }
  ]) assert.throws(() => verifyProviderInvoiceFooter({ ...invoice, ...patch }, attribution), /provider_invoice_/);
  const legacy = { ...invoice, parent: null, subscription: "sub_synthetic" };
  assert.equal(verifyProviderInvoiceFooter(legacy, attribution).invoiceFooterValidated, true);
});

test("provider lifecycle emits success only after verified footer and successful cleanup", () => {
  const source = fs.readFileSync(new URL("../scripts/stripe-provider-lifecycle-e2e.mjs", import.meta.url), "utf8");
  assert.ok(source.indexOf("verifyProviderInvoiceFooter(initialInvoice") > source.indexOf('poll("provider_subscription_cancellation"'));
  assert.ok(source.indexOf("if (lifecycleResult && cleanupOk)") > source.indexOf('await harness("cleanup", fixture)'));
  assert.match(source, /cleanupOk: true/);
  assert.doesNotMatch(source, /invoice_settings.*footer|invoice_creation/);
});


test("provider recipe applies its 293 B footer before subscription creation", async () => {
  const { providerE2ECustomerParams, FRANCHISE_INVOICE_FOOTER } = await import("../scripts/provider-invoice-proof.mjs");
  const params = providerE2ECustomerParams({ attemptId: "attempt123456789", siteId: "site", ownerId: "owner" }, "clock");
  assert.equal(params.invoice_settings.footer, FRANCHISE_INVOICE_FOOTER);
  assert.equal(params.test_clock, "clock");
  assert.equal(params.metadata.site_id, "site");
  assert.equal(params.metadata.owner_id, "owner");
  assert.equal(params.metadata.app, "ajg_site_builder");
  assert.equal(params.address, undefined);
  assert.throws(() => providerE2ECustomerParams({}, "clock"), /fixture_invalid/);
});
