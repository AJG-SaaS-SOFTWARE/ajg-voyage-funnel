export const FRANCHISE_INVOICE_FOOTER = "TVA non applicable - article 293 B du CGI";

// This checks provider evidence, not the legal completeness or visual layout of a PDF.
export function verifyProviderInvoiceFooter(invoice, { customerId, subscriptionId }) {
  const customer = typeof invoice?.customer === "string" ? invoice.customer : invoice?.customer?.id;
  const subscription = invoice?.subscription || invoice?.parent?.subscription_details?.subscription;
  const subscriptionValue = typeof subscription === "string" ? subscription : subscription?.id;
  if (!invoice?.id || invoice.livemode !== false || customer !== customerId || subscriptionValue !== subscriptionId) {
    throw new Error("provider_invoice_attribution_invalid");
  }
  if (invoice.status !== "paid" || !Number.isSafeInteger(invoice.amount_paid) || invoice.amount_paid <= 0) {
    throw new Error("provider_invoice_payment_unconfirmed");
  }
  if (invoice.footer?.trim() !== FRANCHISE_INVOICE_FOOTER) {
    throw new Error("provider_invoice_293b_footer_unconfirmed");
  }
  return { invoiceFooterValidated: true, invoiceId: invoice.id };
}

// Apply the approved franchise mention before Stripe finalizes the first invoice.
// This does not supply or validate the seller's legal identity.
export function providerE2ECustomerParams(fixture, clockId) {
  if (!fixture?.attemptId || !fixture?.siteId || !fixture?.ownerId || !clockId) {
    throw new Error("provider_customer_fixture_invalid");
  }
  return {
    email: `provider-e2e-${fixture.attemptId.slice(0, 12)}@example.invalid`,
    test_clock: clockId,
    invoice_settings: { footer: FRANCHISE_INVOICE_FOOTER },
    metadata: { app: "ajg_site_builder", purpose: "provider_billing_e2e",
      site_id: fixture.siteId, owner_id: fixture.ownerId }
  };
}
