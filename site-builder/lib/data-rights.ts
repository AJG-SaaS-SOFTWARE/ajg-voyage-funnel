"use client";

import { getSupabaseBrowserClient } from "./supabase-browser";
import { getProductLocale } from "./product-i18n";

export type DataErasureRequest = {
  id: string;
  siteId: string | null;
  scope: "site" | "account";
  status: "requested" | "processing" | "completed" | "canceled";
  requestedAt: string;
  processingStartedAt: string | null;
  completedAt: string | null;
  canceledAt: string | null;
};

export async function getMyErasureRequests(): Promise<DataErasureRequest[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("data_erasure_requests")
    .select("id,site_id,scope,status,requested_at,processing_started_at,completed_at,canceled_at")
    .order("requested_at", { ascending: false });

  if (error) throw error;
  return (data || []).map((row: any) => ({
    id: row.id,
    siteId: row.site_id || null,
    scope: row.scope,
    status: row.status,
    requestedAt: row.requested_at,
    processingStartedAt: row.processing_started_at || null,
    completedAt: row.completed_at || null,
    canceledAt: row.canceled_at || null
  }));
}

export async function requestDataErasure(input: {
  scope: "site" | "account";
  siteId?: string;
  confirmation: string;
}) {
  const locale = getProductLocale();
  const tr = (fr: string, en: string) => locale === "en" ? en : fr;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error(tr("Supabase n’est pas configuré.", "Supabase is not configured."));

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error(tr("Votre session a expiré.", "Your session has expired."));

  const response = await fetch("/api/privacy/erasure/request", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      "X-AJG-Locale": locale
    },
    body: JSON.stringify({ ...input, locale })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.error || tr("Impossible d’enregistrer la demande d’effacement.", "Unable to record the erasure request."));
  }
  return result as { requestId: string; scope: "site" | "account" };
}
