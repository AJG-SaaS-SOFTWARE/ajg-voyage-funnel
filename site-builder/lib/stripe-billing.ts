import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const STRIPE_API_VERSION = "2026-08-26.dahlia";
const STRIPE_BASE_URL = "https://api.stripe.com/v1";

type StripeValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | StripeValue[]
  | { [key: string]: StripeValue };

function stripeKey() {
  return (
    process.env.STRIPE_RESTRICTED_KEY ||
    process.env.STRIPE_SECRET_KEY ||
    ""
  ).trim();
}

export function stripeConfigured() {
  return Boolean(stripeKey() && process.env.STRIPE_WEBHOOK_SECRET?.trim());
}

function appendForm(
  form: URLSearchParams,
  key: string,
  value: StripeValue
) {
  if (value === null || value === undefined) return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => appendForm(form, `${key}[${index}]`, item));
    return;
  }

  if (typeof value === "object") {
    Object.entries(value).forEach(([childKey, childValue]) =>
      appendForm(form, `${key}[${childKey}]`, childValue)
    );
    return;
  }

  form.append(key, String(value));
}

export async function stripeRequest<T = any>(
  path: string,
  {
    method = "POST",
    params
  }: {
    method?: "GET" | "POST" | "DELETE";
    params?: Record<string, StripeValue>;
  } = {}
): Promise<T> {
  const key = stripeKey();
  if (!key) throw new Error("stripe_not_configured");

  const form = new URLSearchParams();
  Object.entries(params || {}).forEach(([name, value]) =>
    appendForm(form, name, value)
  );

  const url =
    method === "GET" && form.size
      ? `${STRIPE_BASE_URL}${path}?${form.toString()}`
      : `${STRIPE_BASE_URL}${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Stripe-Version": STRIPE_API_VERSION,
      ...(method !== "GET"
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {})
    },
    body: method !== "GET" ? form.toString() : undefined,
    cache: "no-store"
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code =
      typeof data?.error?.code === "string"
        ? data.error.code
        : `stripe_http_${response.status}`;
    const error = new Error(code);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return data as T;
}

function integrationIdentifier() {
  const suffix = Array.from(
    randomBytes(8),
    (byte) => String.fromCharCode(97 + (byte % 26))
  ).join("");
  return `ajg_builder_${suffix}`;
}

export async function createStripeSubscriptionCheckout(input: {
  siteId: string;
  ownerId: string;
  ownerEmail?: string | null;
  customerId?: string | null;
  priceId: string;
  planKey: "essential" | "growth";
  successUrl: string;
  cancelUrl: string;
}) {
  return stripeRequest<{
    id: string;
    url: string | null;
    customer?: string | null;
    subscription?: string | null;
  }>("/checkout/sessions", {
    params: {
      mode: "subscription",
      line_items: [{ price: input.priceId, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.siteId,
      integration_identifier: integrationIdentifier(),
      billing_address_collection: "required",
      tax_id_collection: { enabled: true, required: "if_supported" },
      ...(process.env.AJG_STRIPE_TAX_ENABLED?.trim().toLowerCase() === "true"
        ? { automatic_tax: { enabled: true } }
        : {}),
      ...(input.customerId
        ? { customer: input.customerId }
        : input.ownerEmail
          ? { customer_email: input.ownerEmail }
          : {}),
      metadata: {
        app: "ajg_site_builder",
        site_id: input.siteId,
        owner_id: input.ownerId,
        plan_key: input.planKey,
        commercial_market: "b2b"
      },
      subscription_data: {
        metadata: {
          app: "ajg_site_builder",
          site_id: input.siteId,
          owner_id: input.ownerId,
          plan_key: input.planKey
        }
      }
    }
  });
}

export async function createStripeOneTimeCheckout(input: {
  siteId: string;
  ownerId: string;
  ownerEmail?: string | null;
  customerId?: string | null;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  return stripeRequest<{
    id: string;
    url: string | null;
    customer?: string | null;
    payment_intent?: string | null;
  }>("/checkout/sessions", {
    params: {
      mode: "payment",
      line_items: [{ price: input.priceId, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.siteId,
      integration_identifier: integrationIdentifier(),
      billing_address_collection: "required",
      tax_id_collection: { enabled: true, required: "if_supported" },
      ...(process.env.AJG_STRIPE_TAX_ENABLED?.trim().toLowerCase() === "true"
        ? { automatic_tax: { enabled: true } }
        : {}),
      ...(input.customerId
        ? { customer: input.customerId }
        : input.ownerEmail
          ? { customer_email: input.ownerEmail }
          : {}),
      metadata: {
        app: "ajg_site_builder",
        site_id: input.siteId,
        owner_id: input.ownerId,
        purchase_type: "ai_launch",
        commercial_market: "b2b"
      }
    }
  });
}

export async function createStripePortalSession(input: {
  customerId: string;
  returnUrl: string;
}) {
  return stripeRequest<{ id: string; url: string }>(
    "/billing_portal/sessions",
    {
      params: {
        customer: input.customerId,
        return_url: input.returnUrl,
        ...(process.env.STRIPE_PORTAL_CONFIGURATION_ID?.trim()
          ? { configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID.trim() }
          : {})
      }
    }
  );
}

export async function retrieveStripeSubscription(subscriptionId: string) {
  return stripeRequest<any>(
    `/subscriptions/${encodeURIComponent(subscriptionId)}`,
    { method: "GET" }
  );
}

export async function cancelStripeSubscription(subscriptionId: string) {
  return stripeRequest<any>(
    `/subscriptions/${encodeURIComponent(subscriptionId)}`,
    {
      method: "DELETE",
      params: {
        invoice_now: false,
        prorate: false
      }
    }
  );
}

function signatures(header: string) {
  const values = header.split(",").map((item) => item.trim());
  const timestamp = values
    .find((item) => item.startsWith("t="))
    ?.slice(2);
  const v1 = values
    .filter((item) => item.startsWith("v1="))
    .map((item) => item.slice(3));
  return { timestamp, v1 };
}

export function verifyStripeWebhookSignature(
  payload: string,
  signatureHeader: string,
  secret = process.env.STRIPE_WEBHOOK_SECRET || "",
  toleranceSeconds = 300
) {
  if (!payload || !signatureHeader || !secret) return false;

  const { timestamp, v1 } = signatures(signatureHeader);
  if (!timestamp || !v1.length || !/^\d+$/.test(timestamp)) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`, "utf8")
    .digest();

  return v1.some((candidate) => {
    if (!/^[a-f0-9]{64}$/i.test(candidate)) return false;
    const actual = Buffer.from(candidate, "hex");
    return (
      actual.length === expected.length &&
      timingSafeEqual(actual, expected)
    );
  });
}

export function stripeSubscriptionIdFromInvoice(invoice: any) {
  const candidate =
    invoice?.parent?.subscription_details?.subscription ??
    invoice?.subscription ??
    null;
  if (typeof candidate === "string") return candidate;
  return typeof candidate?.id === "string" ? candidate.id : "";
}

export function stripeObjectId(value: any) {
  if (typeof value === "string") return value;
  return typeof value?.id === "string" ? value.id : "";
}

export function stripeInvoiceMetadata(invoice: any) {
  const parentMetadata = invoice?.parent?.subscription_details?.metadata;
  if (parentMetadata && typeof parentMetadata === "object") {
    return parentMetadata as Record<string, unknown>;
  }
  const lineMetadata = invoice?.lines?.data?.find(
    (line: any) => line?.metadata && typeof line.metadata === "object"
  )?.metadata;
  return lineMetadata && typeof lineMetadata === "object"
    ? (lineMetadata as Record<string, unknown>)
    : {};
}

export function stripeInvoicePriceId(invoice: any) {
  const line = invoice?.lines?.data?.find((candidate: any) =>
    Boolean(
      candidate?.parent?.subscription_item_details?.subscription ||
      candidate?.subscription ||
      candidate?.price ||
      candidate?.pricing?.price_details?.price
    )
  );
  const price =
    line?.pricing?.price_details?.price ??
    line?.price ??
    line?.plan ??
    null;
  return stripeObjectId(price);
}

export function stripeInvoicePaidThrough(invoice: any) {
  const ends = (Array.isArray(invoice?.lines?.data) ? invoice.lines.data : [])
    .filter((line: any) =>
      Boolean(
        line?.parent?.subscription_item_details?.subscription ||
        line?.subscription
      )
    )
    .map((line: any) => line?.period?.end)
    .filter((value: unknown): value is number =>
      typeof value === "number" && Number.isFinite(value)
    );
  if (!ends.length) return null;
  return new Date(Math.max(...ends) * 1000).toISOString();
}

export function stripeInvoiceIsInitialSubscriptionPayment(invoice: any) {
  return invoice?.billing_reason === "subscription_create";
}

export function stripeInvoiceAccessTransition(
  eventType: string,
  invoice: any
) {
  if (eventType === "invoice.paid") {
    return {
      providerStatus: "active" as const,
      providerEventType: "payment_succeeded" as const,
      startsGrace: false
    };
  }
  if (eventType !== "invoice.payment_failed") return null;
  if (stripeInvoiceIsInitialSubscriptionPayment(invoice)) {
    return {
      providerStatus: "suspended" as const,
      providerEventType: "subscription_pending" as const,
      startsGrace: false
    };
  }
  return {
    providerStatus: "past_due" as const,
    providerEventType: "payment_failed" as const,
    startsGrace: true
  };
}

export function stripePeriodEnd(subscription: any) {
  const rootPeriodEnd = subscription?.current_period_end;
  const itemPeriodEnd = subscription?.items?.data?.[0]?.current_period_end;
  const unix =
    typeof rootPeriodEnd === "number" && Number.isFinite(rootPeriodEnd)
      ? rootPeriodEnd
      : itemPeriodEnd;
  return typeof unix === "number" && Number.isFinite(unix)
    ? new Date(unix * 1000).toISOString()
    : null;
}

export function stripePlanPriceId(subscription: any) {
  const price = subscription?.items?.data?.[0]?.price;
  return stripeObjectId(price);
}

export function normalizeStripeSubscriptionStatus(status: unknown) {
  const value = typeof status === "string" ? status : "";
  if (value === "active") return "active";
  if (value === "trialing") return "trialing";
  if (value === "past_due") return "past_due";
  if (value === "canceled" || value === "incomplete_expired") return "canceled";
  if (value === "unpaid" || value === "paused" || value === "incomplete") return "suspended";
  return "suspended";
}
