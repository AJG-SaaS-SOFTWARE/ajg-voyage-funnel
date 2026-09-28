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

export async function getMyBillingState(): Promise<BillingState | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const site = await getMySite();
  if (!site) return null;
  const { data, error } = await supabase.from("site_billing_states").select("state,paid_through,grace_until,restricted_at,public_suspend_at,export_until,delete_after,provider_status").eq("site_id", site.id).maybeSingle();
  if (error) throw error;
  if (!data) return { state: "active", paidThrough: null, graceUntil: null, restrictedAt: null, publicSuspendAt: null, exportUntil: null, deleteAfter: null, providerStatus: null };
  return {
    state: data.state, paidThrough: data.paid_through, graceUntil: data.grace_until, restrictedAt: data.restricted_at,
    publicSuspendAt: data.public_suspend_at, exportUntil: data.export_until, deleteAfter: data.delete_after, providerStatus: data.provider_status
  };
}

export async function exportMySiteData() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  const site = await getMySite();
  if (!site) throw new Error("Aucun site à exporter.");
  const { data: caps, error: capError } = await supabase.rpc("get_my_site_capabilities", { p_site_id: site.id });
  if (capError) throw capError;
  const cap = Array.isArray(caps) ? caps[0] : caps;
  if (!cap?.can_export) throw new Error("L’export n’est plus disponible pour ce site.");
  const { data: domains, error: domainError } = await supabase.from("domains").select("hostname,kind,verification_status,is_primary").eq("site_id", site.id);
  if (domainError) throw domainError;
  return {
    format: "ajg-builder-export-v1", exportedAt: new Date().toISOString(),
    site: { id: site.id, slug: site.slug, status: site.status, updatedAt: site.updatedAt, config: site.config },
    domains: domains || [],
    note: "Les URLs de médias présentes dans config.contentLibrary permettent de récupérer les fichiers encore conservés. Les droits/licences attachés à chaque média restent décrits dans la configuration."
  };
}
