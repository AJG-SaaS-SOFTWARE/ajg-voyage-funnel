import { growthAnnualIncludesLaunch } from "../../../../lib/growth-launch-offer";
import { NextResponse } from "next/server";
import { billingServiceClient } from "../../../../lib/server-billing";
import {
  normalizeStripeSubscriptionStatus,
  retrieveStripeSubscription,
  stripeInvoiceIsInitialSubscriptionPayment,
  stripeInvoiceMetadata,
  stripeInvoicePaidThrough,
  stripeInvoicePriceId,
  stripeObjectId,
  stripePeriodEnd,
  stripePlanPriceId,
  stripeSubscriptionIdFromInvoice,
  verifyStripeWebhookSignature
} from "../../../../lib/stripe-billing";

export const runtime = "nodejs";

type ResolvedSite = {
  siteId: string;
  ownerId: string;
  planKey: string;
};

function eventTime(event: any) {
  const created = event?.created;
  return typeof created === "number" && Number.isFinite(created)
    ? new Date(created * 1000).toISOString()
    : new Date().toISOString();
}

async function findExistingBySubscription(service: any, subscriptionId: string) {
  if (!subscriptionId) return null;
  const { data, error } = await service
    .from("site_subscriptions")
    .select("site_id,owner_id,plan_key,status,provider_customer_id,provider_subscription_id,provider_price_id,current_period_end")
    .eq("provider", "stripe")
    .eq("provider_subscription_id", subscriptionId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

function planKeyForPrice(priceId: string) {
  if (!priceId) return "";
  const pricePlanMap = new Map<string, "essential" | "growth">(
    [
      [process.env.STRIPE_ESSENTIAL_MONTHLY_PRICE_ID?.trim(), "essential"],
      [process.env.STRIPE_ESSENTIAL_ANNUAL_PRICE_ID?.trim(), "essential"],
      [process.env.STRIPE_GROWTH_MONTHLY_PRICE_ID?.trim(), "growth"],
      [process.env.STRIPE_GROWTH_ANNUAL_PRICE_ID?.trim(), "growth"]
    ].filter((entry): entry is [string, "essential" | "growth"] => Boolean(entry[0]))
  );
  return pricePlanMap.get(priceId) || "";
}

async function resolveSite(
  service: any,
  subscription: any,
  fallback?: { siteId?: string; ownerId?: string }
): Promise<ResolvedSite | null> {
  const subscriptionId = stripeObjectId(subscription);
  const existing = await findExistingBySubscription(service, subscriptionId);

  const metadata =
    subscription?.metadata && typeof subscription.metadata === "object"
      ? subscription.metadata
      : {};
  const siteId =
    existing?.site_id ||
    fallback?.siteId ||
    (typeof metadata.site_id === "string" ? metadata.site_id : "");
  const ownerId =
    existing?.owner_id ||
    fallback?.ownerId ||
    (typeof metadata.owner_id === "string" ? metadata.owner_id : "");

  if (!siteId || !ownerId) return null;

  const { data: site, error: siteError } = await service
    .from("sites")
    .select("id,owner_id")
    .eq("id", siteId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (siteError) throw siteError;
  if (!site) return null;

  const priceId = stripePlanPriceId(subscription);
  const mappedPlan = planKeyForPrice(priceId);
  const existingPlan =
    existing?.plan_key === "essential" || existing?.plan_key === "growth"
      ? existing.plan_key
      : "";
  const planKey = mappedPlan || existingPlan;

  if (!planKey) return null;
  return { siteId, ownerId, planKey };
}

function aiLaunchOperations() {
  const raw = Number(process.env.AJG_AI_LAUNCH_OPERATIONS || "4");
  if (!Number.isFinite(raw)) return 4;
  return Math.max(1, Math.min(20, Math.floor(raw)));
}

async function grantAiLaunch(
  service: any,
  input: {
    siteId: string;
    ownerId: string;
    source: "stripe_purchase" | "growth_annual";
    externalReference: string;
  }
) {
  const { data: site, error: siteError } = await service
    .from("sites")
    .select("id,owner_id")
    .eq("id", input.siteId)
    .eq("owner_id", input.ownerId)
    .maybeSingle();
  if (siteError) throw siteError;
  if (!site) return "ignored";

  const { error } = await service
    .from("site_ai_launch_entitlements")
    .upsert(
      {
        site_id: input.siteId,
        owner_id: input.ownerId,
        source: input.source,
        status: "active",
        operations_total: aiLaunchOperations(),
        operations_used: 0,
        external_reference: input.externalReference,
        updated_at: new Date().toISOString()
      },
      { onConflict: "external_reference", ignoreDuplicates: true }
    );
  if (error) throw error;
  return "granted";
}

async function bindAndApply(
  service: any,
  event: any,
  subscription: any,
  sourceEventType: string,
  fallback?: { siteId?: string; ownerId?: string }
) {
  const resolved = await resolveSite(service, subscription, fallback);
  if (!resolved) return "ignored";

  const subscriptionId = stripeObjectId(subscription);
  const customerId = stripeObjectId(subscription?.customer);
  const priceId = stripePlanPriceId(subscription);
  if (!subscriptionId || !customerId) return "ignored";

  const rawStatus =
    typeof subscription?.status === "string" ? subscription.status : "";
  const status = normalizeStripeSubscriptionStatus(rawStatus);
  const periodEnd = stripePeriodEnd(subscription);

  const { error: bindError } = await service.rpc(
    "bind_builder_site_subscription_provider",
    {
      p_site_id: resolved.siteId,
      p_owner_id: resolved.ownerId,
      p_plan_key: resolved.planKey,
      p_provider: "stripe",
      p_provider_customer_id: customerId,
      p_provider_subscription_id: subscriptionId,
      p_provider_price_id: priceId || null,
      p_provider_status: status,
      p_current_period_end: periodEnd
    }
  );
  if (bindError) throw bindError;

  let providerEventType = "subscription_updated";
  if (sourceEventType === "invoice.payment_failed") {
    providerEventType = "payment_failed";
  } else if (sourceEventType === "invoice.paid") {
    providerEventType = "payment_succeeded";
  } else if (sourceEventType === "customer.subscription.deleted") {
    providerEventType = "subscription_canceled";
  } else if (rawStatus === "active" || rawStatus === "trialing") {
    providerEventType = "subscription_active";
  } else if (rawStatus === "past_due" || rawStatus === "unpaid") {
    providerEventType = "subscription_past_due";
  } else if (rawStatus === "incomplete" || rawStatus === "paused") {
    providerEventType = "subscription_pending";
  }

  const failedAt =
    providerEventType === "payment_failed" ||
    providerEventType === "subscription_past_due"
      ? eventTime(event)
      : null;

  const { data, error } = await service.rpc(
    "apply_builder_site_billing_provider_event",
    {
      p_provider: "stripe",
      p_event_id: event.id,
      p_event_type: providerEventType,
      p_site_id: resolved.siteId,
      p_owner_id: resolved.ownerId,
      p_provider_status: status,
      p_paid_through: periodEnd,
      p_failed_at: failedAt,
      p_provider_subscription_id: subscriptionId
    }
  );
  if (error) throw error;

  if (
    growthAnnualIncludesLaunch() &&
    resolved.planKey === "growth" &&
    priceId &&
    priceId === process.env.STRIPE_GROWTH_ANNUAL_PRICE_ID?.trim() &&
    rawStatus === "active"
  ) {
    await grantAiLaunch(service, {
      siteId: resolved.siteId,
      ownerId: resolved.ownerId,
      source: "growth_annual",
      externalReference: `growth_annual:${resolved.siteId}`
    });
  }

  return typeof data === "string" ? data : "processed";
}

async function bindAndApplyInvoice(
  service: any,
  event: any,
  invoice: any
) {
  const subscriptionId = stripeSubscriptionIdFromInvoice(invoice);
  if (!subscriptionId) return "ignored";

  const existing = await findExistingBySubscription(service, subscriptionId);
  const metadata = stripeInvoiceMetadata(invoice);
  const siteId =
    existing?.site_id ||
    (typeof metadata.site_id === "string" ? metadata.site_id : "");
  const ownerId =
    existing?.owner_id ||
    (typeof metadata.owner_id === "string" ? metadata.owner_id : "");
  if (!siteId || !ownerId) return "ignored";

  const { data: site, error: siteError } = await service
    .from("sites")
    .select("id,owner_id")
    .eq("id", siteId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (siteError) throw siteError;
  if (!site) return "ignored";

  const priceId =
    stripeInvoicePriceId(invoice) ||
    (typeof existing?.provider_price_id === "string"
      ? existing.provider_price_id
      : "");
  const mappedPlan = planKeyForPrice(priceId);
  const existingPlan =
    existing?.plan_key === "essential" || existing?.plan_key === "growth"
      ? existing.plan_key
      : "";
  const metadataPlan =
    metadata.plan_key === "essential" || metadata.plan_key === "growth"
      ? metadata.plan_key
      : "";
  const planKey = mappedPlan || existingPlan || metadataPlan;
  if (!planKey) return "ignored";

  const customerId =
    stripeObjectId(invoice?.customer) ||
    (typeof existing?.provider_customer_id === "string"
      ? existing.provider_customer_id
      : "");
  if (!customerId) return "ignored";

  const paid = event.type === "invoice.paid";
  const initialFailure =
    event.type === "invoice.payment_failed" &&
    stripeInvoiceIsInitialSubscriptionPayment(invoice);
  const providerStatus = paid
    ? "active"
    : initialFailure
      ? "suspended"
      : "past_due";
  const providerEventType = paid
    ? "payment_succeeded"
    : initialFailure
      ? "subscription_pending"
      : "payment_failed";
  const invoicePaidThrough = paid ? stripeInvoicePaidThrough(invoice) : null;
  const paidThrough =
    invoicePaidThrough ||
    (typeof existing?.current_period_end === "string"
      ? existing.current_period_end
      : null);

  const { error: bindError } = await service.rpc(
    "bind_builder_site_subscription_provider",
    {
      p_site_id: siteId,
      p_owner_id: ownerId,
      p_plan_key: planKey,
      p_provider: "stripe",
      p_provider_customer_id: customerId,
      p_provider_subscription_id: subscriptionId,
      p_provider_price_id: priceId || null,
      p_provider_status: providerStatus,
      p_current_period_end: paidThrough
    }
  );
  if (bindError) throw bindError;

  const { data, error } = await service.rpc(
    "apply_builder_site_billing_provider_event",
    {
      p_provider: "stripe",
      p_event_id: event.id,
      p_event_type: providerEventType,
      p_site_id: siteId,
      p_owner_id: ownerId,
      p_provider_status: providerStatus,
      p_paid_through: paidThrough,
      p_failed_at: providerEventType === "payment_failed" ? eventTime(event) : null,
      p_provider_subscription_id: subscriptionId
    }
  );
  if (error) throw error;

  if (
    paid &&
    growthAnnualIncludesLaunch() &&
    planKey === "growth" &&
    priceId === process.env.STRIPE_GROWTH_ANNUAL_PRICE_ID?.trim()
  ) {
    await grantAiLaunch(service, {
      siteId,
      ownerId,
      source: "growth_annual",
      externalReference: `growth_annual:${siteId}`
    });
  }

  return typeof data === "string" ? data : "processed";
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 262_144) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") || "";
  if (!verifyStripeWebhookSignature(payload, signature)) {
    return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!event?.id || !event?.type || !event?.data?.object) {
    return NextResponse.json({ error: "Invalid Stripe event" }, { status: 400 });
  }

  const service = billingServiceClient();
  if (!service) {
    return NextResponse.json({ error: "Billing backend unavailable" }, { status: 503 });
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object;
      const subscriptionId = stripeObjectId(session.subscription);
      if (!subscriptionId) {
        const siteId =
          typeof session.client_reference_id === "string"
            ? session.client_reference_id
            : typeof session?.metadata?.site_id === "string"
              ? session.metadata.site_id
              : "";
        const ownerId =
          typeof session?.metadata?.owner_id === "string"
            ? session.metadata.owner_id
            : "";
        const isAiLaunch =
          session?.metadata?.purchase_type === "ai_launch";
        const paid =
          session?.payment_status === "paid" ||
          event.type === "checkout.session.async_payment_succeeded";

        if (isAiLaunch && paid && siteId && ownerId) {
          const result = await grantAiLaunch(service, {
            siteId,
            ownerId,
            source: "stripe_purchase",
            externalReference: `stripe_checkout:${session.id}`
          });
          return NextResponse.json({ received: true, result });
        }
        return NextResponse.json({ received: true, result: "ignored" });
      }
      const subscription = await retrieveStripeSubscription(subscriptionId);
      const result = await bindAndApply(service, event, subscription, event.type, {
        siteId:
          typeof session.client_reference_id === "string"
            ? session.client_reference_id
            : typeof session?.metadata?.site_id === "string"
              ? session.metadata.site_id
              : "",
        ownerId:
          typeof session?.metadata?.owner_id === "string"
            ? session.metadata.owner_id
            : ""
      });
      return NextResponse.json({ received: true, result });
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const result = await bindAndApply(
        service,
        event,
        event.data.object,
        event.type
      );
      return NextResponse.json({ received: true, result });
    }

    if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      const result = await bindAndApplyInvoice(
        service,
        event,
        event.data.object
      );
      return NextResponse.json({ received: true, result });
    }

    return NextResponse.json({ received: true, result: "ignored" });
  } catch (error) {
    console.error("Stripe webhook processing failed", {
      eventId: event.id,
      eventType: event.type,
      code: error instanceof Error ? error.message : "unknown"
    });
    return NextResponse.json(
      { error: "Stripe event processing failed" },
      { status: 500 }
    );
  }
}
