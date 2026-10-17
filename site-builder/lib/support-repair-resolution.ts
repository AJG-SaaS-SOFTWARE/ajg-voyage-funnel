import type { SupabaseClient } from "@supabase/supabase-js";
import type { SupportRepairResult } from "./support-remediation";
import type { SupportCheck } from "./support-diagnostics";
import { supportRecoveryIsVerified } from "./support-reconcile-policy";
import { preferredPublishedRootDomain } from "./published-domain";

export type RepairTicketSnapshot = { id: string; user_id: string; site_id: string;
  status: string; category: string; updated_at: string; diagnosis: unknown };
export async function resolveVerifiedSupportRepair(service: SupabaseClient, input: {
  ticket: RepairTicketSnapshot | null; userId: string; siteId: string;
  repair: SupportRepairResult;
  health: { siteId: string | null; diagnosis: { checks: SupportCheck[] } };
}): Promise<{ resolved: boolean; audited: boolean }> {
  const no = { resolved: false, audited: false };
  const { ticket: t, repair: r, health: h } = input;
  if (!t || t.user_id!==input.userId || t.site_id!==input.siteId || t.category!=="domain" ||
      !["diagnosed","waiting_customer"].includes(t.status) || !t.updated_at ||
      r.siteId!==input.siteId || r.status!=="succeeded" || r.verified!==true || r.audited!==true ||
      r.code!=="managed_domain_primary_repaired" || h.siteId!==input.siteId ||
      !supportRecoveryIsVerified({ category:t.category,previousDiagnosis:t.diagnosis,checks:h.diagnosis.checks })) return no;
  try {
    const { data, error } = await service.rpc("resolve_verified_primary_support_repair", {
      p_ticket_id:t.id,p_user_id:input.userId,p_site_id:input.siteId,
      p_expected_updated_at:t.updated_at,p_diagnosis:h.diagnosis,p_root_domain:preferredPublishedRootDomain(),
    });
    if (error || !data || data.ticketId!==t.id || data.status!=="resolved" ||
        typeof data.eventId!=="string" || !/^[1-9][0-9]*$/.test(data.eventId) ||
        typeof data.repairRunId!=="string" || !/^[0-9a-f-]{36}$/i.test(data.repairRunId) ||
        typeof data.updatedAt!=="string" || !Number.isFinite(Date.parse(data.updatedAt))) return no;
    const [ticket, event] = await Promise.all([
      service.from("support_tickets").select("id,status,resolution_code,updated_at")
        .eq("id",t.id).eq("user_id",input.userId).eq("site_id",input.siteId).maybeSingle(),
      service.from("support_ticket_events").select("ticket_id,actor_type,event_type,metadata")
        .eq("id",data.eventId).eq("ticket_id",t.id).maybeSingle(),
    ]);
    if (ticket.error || event.error || ticket.data?.id!==t.id || ticket.data.status!=="resolved" ||
        ticket.data.resolution_code!=="auto_verified_managed_primary_repair" ||
        ticket.data.updated_at!==data.updatedAt || event.data?.ticket_id!==t.id || event.data.actor_type!=="system" ||
        event.data.event_type!=="resolution" || event.data.metadata?.status!=="resolved" ||
        event.data.metadata?.repair_run_id!==data.repairRunId ||
        event.data.metadata?.resolution_code!=="auto_verified_managed_primary_repair" ||
        event.data.metadata?.previous_updated_at!==t.updated_at ||
        event.data.metadata?.updated_at!==data.updatedAt) return no;
    return { resolved:true,audited:true };
  } catch { return no; } // Lost ACK is not retried; no false resolution receipt.
}
