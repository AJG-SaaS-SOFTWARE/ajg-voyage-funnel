/** Server-side eligibility for a purchased BUILD grant.
 * Signed Stripe webhook verification must happen BEFORE calling this helper.
 * An asynchronous success event alone is not payment evidence.
 */
export function paidAiLaunchCheckout(session: {
  id?: unknown;
  mode?: unknown;
  payment_status?: unknown;
  metadata?: { purchase_type?: unknown } | null;
} | null | undefined): boolean {
  return !!session &&
    typeof session.id === "string" && session.id.startsWith("cs_") &&
    session.mode === "payment" &&
    session.payment_status === "paid" &&
    session.metadata?.purchase_type === "ai_launch";
}
