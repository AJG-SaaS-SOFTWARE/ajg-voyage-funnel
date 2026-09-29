"use client";

import { getSupabaseBrowserClient } from "./supabase-browser";
import { getMySite } from "./supabase-site-repository";

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
};

export async function getMyBillingState(siteId?: string): Promise<BillingState | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const site = await getMySite(siteId);
  if (!site) return null;
  const [{ data, error }, { data: subscription, error: subscriptionError }] = await Promise.all([
    supabase.from("site_billing_states").select("state,paid_through,grace_until,restricted_at,public_suspend_at,export_until,delete_after,provider_status").eq("site_id", site.id).maybeSingle(),
    supabase.from("site_subscriptions").select("provider,provider_customer_id").eq("site_id", site.id).maybeSingle()
  ]);
  if (error) throw error;
  if (subscriptionError) throw subscriptionError;
  if (!data) return {
    state: "active", paidThrough: null, graceUntil: null, restrictedAt: null,
    publicSuspendAt: null, exportUntil: null, deleteAfter: null, providerStatus: null,
    provider: subscription?.provider || null,
    hasBillingAccount: Boolean(subscription?.provider === "stripe" && subscription?.provider_customer_id)
  };
  return {
    state: data.state, paidThrough: data.paid_through, graceUntil: data.grace_until, restrictedAt: data.restricted_at,
    publicSuspendAt: data.public_suspend_at, exportUntil: data.export_until, deleteAfter: data.delete_after, providerStatus: data.provider_status,
    provider: subscription?.provider || null,
    hasBillingAccount: Boolean(subscription?.provider === "stripe" && subscription?.provider_customer_id)
  };
}

export async function downloadMySiteExport(siteId?: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error("Votre session a expiré.");
  const site = await getMySite(siteId);
  if (!site) throw new Error("Site introuvable.");
  const response = await fetch(
    `/api/export/site?siteId=${encodeURIComponent(site.id)}&format=archive`,
    { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" }
  );
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "Export impossible.");
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const filename = disposition.match(/filename="([^"]+)"/i)?.[1]
    || `ajg-builder-export-${site.slug || "site"}.tar.gz`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}


async function openStripeBillingPath(path: "/api/billing/checkout" | "/api/billing/portal", siteId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error("Votre session a expiré.");

  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ siteId })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || typeof result?.url !== "string") {
    throw new Error(result?.error || "Le service de facturation est indisponible.");
  }
  window.location.assign(result.url);
}

export async function startProCheckout(siteId: string) {
  return openStripeBillingPath("/api/billing/checkout", siteId);
}

export async function openStripeBillingPortal(siteId: string) {
  return openStripeBillingPath("/api/billing/portal", siteId);
}
