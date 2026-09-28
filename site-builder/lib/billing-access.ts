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
};

export async function getMyBillingState(siteId?: string): Promise<BillingState | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const site = await getMySite(siteId);
  if (!site) return null;
  const { data, error } = await supabase.from("site_billing_states").select("state,paid_through,grace_until,restricted_at,public_suspend_at,export_until,delete_after,provider_status").eq("site_id", site.id).maybeSingle();
  if (error) throw error;
  if (!data) return { state: "active", paidThrough: null, graceUntil: null, restrictedAt: null, publicSuspendAt: null, exportUntil: null, deleteAfter: null, providerStatus: null };
  return {
    state: data.state, paidThrough: data.paid_through, graceUntil: data.grace_until, restrictedAt: data.restricted_at,
    publicSuspendAt: data.public_suspend_at, exportUntil: data.export_until, deleteAfter: data.delete_after, providerStatus: data.provider_status
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
