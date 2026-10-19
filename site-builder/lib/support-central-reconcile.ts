import type { SupabaseClient } from "@supabase/supabase-js";
import { readSupportTicketInRun, resolveSupportTicketInRun } from "./run-intake-reporting";
import { supportScanWindow } from "./support-scan-window";

const SCAN_LIMIT = 20;
const CONFIRM_LIMIT = 2;
const RESOLUTION = "auto_verified_managed_primary_repair";
const MARKER = "ajg-run-resolution-confirmed";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Ticket = { id: string; user_id: string; site_id: string; category: string;
  status: string; updated_at: string; resolved_at: string; resolution_code: string };
type Scope = { ticketId: string; userId: string; siteId: string };
export type SupportCentralReconcileResult = {
  ok: boolean; scanned: number; checked: number; confirmed: number;
  alreadyConfirmed: number; completed: number; failed: number; error?: string;
};
function result(): SupportCentralReconcileResult {
  return { ok: true, scanned: 0, checked: 0, confirmed: 0, alreadyConfirmed: 0, completed: 0, failed: 0 };
}
function eventId(value: unknown): string | null {
  if (typeof value === "number" && !Number.isSafeInteger(value)) return null;
  return (typeof value === "number" || typeof value === "string") && /^[1-9][0-9]{0,19}$/.test(String(value)) ? String(value) : null;
}
function sameTicket(a: Ticket, b: Ticket | null): boolean {
  return Boolean(b && ["id", "user_id", "site_id", "status", "category", "updated_at", "resolved_at", "resolution_code"]
    .every(key => a[key as keyof Ticket] === b[key as keyof Ticket]));
}

async function reconcile(service: SupabaseClient, now: Date, scope?: Scope) {
  const out = result();
  const queue = () => {
    let q = service.from("support_tickets").select("id", { count: "exact", head: true })
      .eq("category", "domain").eq("resolution_code", RESOLUTION).in("status", ["resolved", "closed"]);
    if (scope) q = q.eq("id", scope.ticketId).eq("user_id", scope.userId).eq("site_id", scope.siteId);
    return q;
  };
  const count = await queue();
  if (count.error || (scope && count.count !== 1)) throw new Error("support_central_queue_unavailable");
  const window = supportScanWindow(count.count, now, SCAN_LIMIT);
  if (!window.count) return out;
  let read = service.from("support_tickets")
    .select("id,user_id,site_id,status,category,updated_at,resolved_at,resolution_code")
    .eq("category", "domain").eq("resolution_code", RESOLUTION).in("status", ["resolved", "closed"]);
  if (scope) read = read.eq("id", scope.ticketId).eq("user_id", scope.userId).eq("site_id", scope.siteId);
  const rows = await read.order("id", { ascending: true }).range(window.offset, window.end).limit(SCAN_LIMIT);
  if (rows.error || !Array.isArray(rows.data) || (scope && (rows.data.length !== 1 ||
      rows.data[0]?.id !== scope.ticketId || rows.data[0]?.user_id !== scope.userId || rows.data[0]?.site_id !== scope.siteId))) {
    throw new Error("support_central_queue_unavailable");
  }
  const tickets = rows.data as Ticket[];
  out.scanned = tickets.length;
  // Confirmed rows stay in the population: rotate both the window and its
  // two selected slots so that a fixed prefix cannot starve pending rows.
  const start = tickets.length ? (window.cycle * CONFIRM_LIMIT) % tickets.length : 0;
  const ordered = [...tickets.slice(start), ...tickets.slice(0, start)].slice(0, CONFIRM_LIMIT);
  for (const ticket of ordered) {
    out.checked++;
    try {
      if (![ticket.id, ticket.user_id, ticket.site_id].every(id => UUID.test(id)) ||
          ticket.category !== "domain" || !["resolved", "closed"].includes(ticket.status) || ticket.resolution_code !== RESOLUTION ||
          !Number.isFinite(Date.parse(ticket.updated_at)) || !Number.isFinite(Date.parse(ticket.resolved_at)) ||
          Date.parse(ticket.resolved_at) > now.getTime()) throw new Error("evidence");
      const [receipt, audit] = await Promise.all([
        service.from("support_ticket_events").select("ticket_id,actor_type,event_type,metadata", { count: "exact" })
          .eq("ticket_id", ticket.id).eq("actor_type", "system").eq("event_type", "diagnostic")
          .eq("metadata->>source", "ajg-run-intake").limit(2),
        service.from("support_ticket_events").select("id,ticket_id,actor_type,event_type,metadata", { count: "exact" })
          .eq("ticket_id", ticket.id).eq("actor_type", "system").eq("event_type", "resolution")
          .eq("metadata->>updated_at", ticket.updated_at).eq("metadata->>resolution_code", RESOLUTION)
          .eq("metadata->>status", ticket.status).limit(2),
      ]);
      const ids = new Set((receipt.data || []).map(row => row.metadata?.request_id));
      const requestId = [...ids][0];
      const event = audit.data?.[0], resolutionEventId = eventId(event?.id);
      if (receipt.error || !Array.isArray(receipt.data) || receipt.count !== receipt.data.length || ids.size !== 1 ||
          typeof requestId !== "string" || !/^req_[0-9a-f]{8}$/.test(requestId) ||
          receipt.data.some(row => row.ticket_id !== ticket.id || row.actor_type !== "system" || row.event_type !== "diagnostic" || row.metadata?.source !== "ajg-run-intake") ||
          audit.error || audit.count !== 1 || audit.data?.length !== 1 || !event || !resolutionEventId ||
          event.ticket_id !== ticket.id || event.actor_type !== "system" || event.event_type !== "resolution" ||
          event.metadata?.status !== ticket.status || event.metadata?.updated_at !== ticket.updated_at ||
          event.metadata?.resolution_code !== RESOLUTION || !UUID.test(event.metadata?.repair_run_id || "")) throw new Error("evidence");
      const repairRunId = event.metadata.repair_run_id as string;
      const repair = await service.from("support_remediation_runs")
        .select("id,ticket_id,user_id,site_id,action,status,result_code")
        .eq("id", repairRunId).eq("ticket_id", ticket.id).eq("user_id", ticket.user_id).eq("site_id", ticket.site_id)
        .eq("action", "managed_domain_repair").eq("status", "succeeded").eq("result_code", "managed_domain_primary_repaired").maybeSingle();
      if (repair.error || repair.data?.id !== repairRunId || repair.data.ticket_id !== ticket.id ||
          repair.data.user_id !== ticket.user_id || repair.data.site_id !== ticket.site_id ||
          repair.data.action !== "managed_domain_repair" || repair.data.status !== "succeeded" ||
          repair.data.result_code !== "managed_domain_primary_repaired") throw new Error("evidence");
      const metadata = { source: MARKER, request_id: requestId, ticket_updated_at: ticket.updated_at,
        resolution_event_id: resolutionEventId, repair_run_id: repairRunId };
      const markers = await service.from("support_ticket_events").select("metadata")
        .eq("ticket_id", ticket.id).eq("actor_type", "system").eq("event_type", "diagnostic")
        .eq("metadata->>source", MARKER).eq("metadata->>request_id", requestId)
        .eq("metadata->>ticket_updated_at", ticket.updated_at).eq("metadata->>resolution_event_id", resolutionEventId)
        .eq("metadata->>repair_run_id", repairRunId).limit(1);
      if (markers.error || !Array.isArray(markers.data)) throw new Error("evidence");
      if (markers.data.some(row => Object.entries(metadata).every(([k, v]) => row.metadata?.[k] === v))) {
        out.alreadyConfirmed++;
        continue;
      }
      const central = await readSupportTicketInRun(ticket.id, requestId);
      if (!central || (central.status === "resolved" && !central.resolutionVerified)) throw new Error("central");
      if (central.status !== "resolved") {
        // Exact pending identity was positively read. This idempotent completion
        // revalidates the source and CAS on the server; it never repairs a site.
        if (!(await resolveSupportTicketInRun(ticket.id, requestId))) throw new Error("central");
        out.completed++;
      }
      const fresh = await service.from("support_tickets")
        .select("id,user_id,site_id,status,category,updated_at,resolved_at,resolution_code")
        .eq("id", ticket.id).eq("user_id", ticket.user_id).eq("site_id", ticket.site_id).maybeSingle();
      if (fresh.error || !sameTicket(ticket, fresh.data as Ticket | null)) throw new Error("evidence");
      const marker = await service.from("support_ticket_events").insert({ ticket_id: ticket.id,
        actor_type: "system", event_type: "diagnostic", metadata })
        .select("id,ticket_id,actor_type,event_type,metadata").single();
      if (marker.error || !eventId(marker.data?.id) || marker.data.ticket_id !== ticket.id ||
          marker.data.actor_type !== "system" || marker.data.event_type !== "diagnostic" ||
          !Object.entries(metadata).every(([k, v]) => marker.data.metadata?.[k] === v)) throw new Error("marker");
      out.confirmed++;
    } catch {
      out.failed++;
      out.error = "support_central_confirmation_unconfirmed";
    }
  }
  out.ok = out.failed === 0;
  return out;
}

export async function runSupportCentralReconciliationSafely(service: SupabaseClient, now = new Date()) {
  try { return await reconcile(service, now); }
  catch { return { ...result(), ok: false, failed: 1, error: "support_central_queue_unavailable" }; }
}

/** Controlled recipe: no unrelated ticket enters either the count or row read. */
export async function reconcileCentralSupportForTicket(service: SupabaseClient,
  userId: string, siteId: string, ticketId: string, now = new Date()) {
  try {
    if (![userId, siteId, ticketId].every(id => UUID.test(id))) throw new Error("scope");
    return await reconcile(service, now, { userId, siteId, ticketId });
  } catch { return { ...result(), ok: false, failed: 1, error: "support_central_queue_unavailable" }; }
}
