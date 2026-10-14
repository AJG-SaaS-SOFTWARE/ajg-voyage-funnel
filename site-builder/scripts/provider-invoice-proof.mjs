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
