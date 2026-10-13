"use client";

import { getSupabaseBrowserClient } from "./supabase-browser";
import { getMySite } from "./supabase-site-repository";
import { siteConfigFromRecoveryExport } from "./site-recovery";
import { getProductLocale } from "./product-i18n";

export type BillingState = {
  state: string;
  paidThrough: string | null;
  graceUntil: string | null;
  restrictedAt: string | null;
  publicSuspendAt: string | null;
  exportUntil: string | null;
  deleteAfter: string | null;
  providerStatus: string | null;
  provider: string | null;
  hasBillingAccount: boolean;
  hasStripeSubscription: boolean;
};

export async function getMyBillingState(siteId?: string): Promise<BillingState | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const site = await getMySite(siteId);
  if (!site) return null;
  const [{ data, error }, { data: subscription, error: subscriptionError }] = await Promise.all([
    supabase.from("site_billing_states").select("state,paid_through,grace_until,restricted_at,public_suspend_at,export_until,delete_after,provider_status").eq("site_id", site.id).eq("owner_id", site.ownerId).maybeSingle(),
    supabase.from("site_subscriptions").select("provider,provider_customer_id,provider_subscription_id,status").eq("site_id", site.id).eq("owner_id", site.ownerId).maybeSingle()
  ]);
  if (error) throw error;
  if (subscriptionError) throw subscriptionError;
  if (!data) return {
    state: "active", paidThrough: null, graceUntil: null, restrictedAt: null,
    publicSuspendAt: null, exportUntil: null, deleteAfter: null, providerStatus: null,
    provider: subscription?.provider || null,
    hasBillingAccount: Boolean(subscription?.provider === "stripe" && subscription?.provider_customer_id),
    hasStripeSubscription: Boolean(
      subscription?.provider === "stripe"
      && subscription?.provider_subscription_id
      && !["canceled", "incomplete_expired"].includes(subscription?.status || "")
    )
  };
  return {
    state: data.state, paidThrough: data.paid_through, graceUntil: data.grace_until, restrictedAt: data.restricted_at,
    publicSuspendAt: data.public_suspend_at, exportUntil: data.export_until, deleteAfter: data.delete_after, providerStatus: data.provider_status,
    provider: subscription?.provider || null,
    hasBillingAccount: Boolean(subscription?.provider === "stripe" && subscription?.provider_customer_id),
    hasStripeSubscription: Boolean(
      subscription?.provider === "stripe"
      && subscription?.provider_subscription_id
      && !["canceled", "incomplete_expired"].includes(subscription?.status || "")
    )
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  let anchor: HTMLAnchorElement | null = null;
  try {
    anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor?.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function downloadMySiteExport(siteId?: string) {
  const locale = getProductLocale();
  const tr = (fr: string, en: string) => locale === "en" ? en : fr;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error(tr("Supabase n’est pas configuré.", "Supabase is not configured."));
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error(tr("Votre session a expiré.", "Your session has expired."));
  const site = await getMySite(siteId);
  if (!site) throw new Error(tr("Site introuvable.", "Website not found."));
  const response = await fetch(
    `/api/export/site?siteId=${encodeURIComponent(site.id)}&format=archive`,
    { headers: { Authorization: `Bearer ${session.access_token}`, "X-AJG-Locale": locale }, cache: "no-store" }
  );
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || tr("Export impossible.", "Export unavailable."));
  }

  let blob: Blob;
  try {
    if (!/^application\/(?:x-)?gzip(?:\s*;|$)/i.test(response.headers.get("content-type") || "")) {
      throw new Error("invalid_archive_type");
    }
    blob = await response.blob();
    const signature = new Uint8Array(await blob.slice(0, 3).arrayBuffer());
    if (blob.size < 18 || signature[0] !== 0x1f || signature[1] !== 0x8b || signature[2] !== 0x08) {
      throw new Error("invalid_archive_signature");
    }
  } catch {
    throw new Error(tr("Le fichier d’archive reçu est invalide ou incomplet. Réessayez plus tard.", "The received archive is invalid or incomplete. Please try again later."));
  }
  const disposition = response.headers.get("content-disposition") || "";
  const filename = disposition.match(/filename="([^"]+)"/i)?.[1]
    || `eltara-export-${site.slug || "site"}.tar.gz`;
  downloadBlob(blob, filename);
}


export async function downloadMySiteRecoveryJson(siteId?: string) {
  const locale = getProductLocale();
  const tr = (fr: string, en: string) => locale === "en" ? en : fr;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error(tr("Supabase n’est pas configuré.", "Supabase is not configured."));
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error(tr("Votre session a expiré.", "Your session has expired."));
  const site = await getMySite(siteId);
  if (!site) throw new Error(tr("Site introuvable.", "Website not found."));
  const response = await fetch(
    `/api/export/site?siteId=${encodeURIComponent(site.id)}&format=recovery`,
    { headers: { Authorization: `Bearer ${session.access_token}`, "X-AJG-Locale": locale }, cache: "no-store" }
  );
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || tr("Export de restauration impossible.", "Recovery export unavailable."));
  }
  let blob: Blob;
  try {
    if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") || "")) {
      throw new Error("invalid_recovery_type");
    }
    blob = await response.blob();
    siteConfigFromRecoveryExport(JSON.parse(await blob.text()), { id: site.id, slug: site.slug });
  } catch {
    throw new Error(tr("Le fichier de restauration reçu est invalide ou incomplet. Réessayez plus tard.", "The received recovery file is invalid or incomplete. Please try again later."));
  }
  downloadBlob(blob, `eltara-recovery-${site.slug || "site"}.json`);
}

async function openStripeBillingPath(
  path: "/api/billing/checkout" | "/api/billing/portal",
  siteId: string,
  payload: Record<string, unknown> = {}
) {
  const locale = getProductLocale();
  const tr = (fr: string, en: string) => locale === "en" ? en : fr;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error(tr("Supabase n’est pas configuré.", "Supabase is not configured."));
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error(tr("Votre session a expiré.", "Your session has expired."));

  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      "X-AJG-Locale": locale
    },
    body: JSON.stringify({ siteId, locale, ...payload })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || typeof result?.url !== "string") {
    throw new Error(result?.error || tr("Le service de facturation est indisponible.", "The billing service is unavailable."));
  }
  window.location.assign(result.url);
}

// Coalesce concurrent requests in the same tab. All callers observe the
// same result; a new explicit click after a failure creates a fresh attempt.
const pendingSubscriptionAttempts = new Map<string, Promise<void>>();

export function startPlanCheckout(
  siteId: string,
  planKey: "essential" | "growth",
  billingCycle: "monthly" | "annual"
): Promise<void> {
  const intent = JSON.stringify([siteId, planKey, billingCycle]);
  const pending = pendingSubscriptionAttempts.get(intent);
  if (pending) return pending;
  const checkoutAttemptId = crypto.randomUUID();
  const task = openStripeBillingPath("/api/billing/checkout", siteId, {
    planKey, billingCycle, checkoutAttemptId
  }).finally(() => {
    pendingSubscriptionAttempts.delete(intent);
  });
  pendingSubscriptionAttempts.set(intent, task);
  return task;
}

export async function startGrowthCheckout(siteId: string) {
  return startPlanCheckout(siteId, "growth", "monthly");
}

export async function startAiLaunchCheckout(siteId: string) {
  return openStripeBillingPath("/api/billing/checkout", siteId, {
    purchaseType: "ai_launch"
  });
}

export async function openStripeBillingPortal(siteId: string) {
  return openStripeBillingPath("/api/billing/portal", siteId);
}

