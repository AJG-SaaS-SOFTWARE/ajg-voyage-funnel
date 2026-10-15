import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createSupportHealthDiagnoser, type diagnoseSupportHealth } from "./support-health-server";
import { supportCustomerAction, supportReconcileDecision } from "./support-reconcile-policy";
import { supportScanWindow } from "./support-scan-window";
import { recordSupportEvent } from "./support-events";

export type SupportReconcileResult = {
  ok: boolean;
  scanned: number;
  resolved: number;
  escalated: number;
  waiting: number;
  failed: number;
  error?: string;
};

type WaitingTicket = {
  id: string;
  user_id: string;
  site_id: string | null;
  created_at: string;
  updated_at: string;
  category: string;
  diagnosis: unknown;
};

async function reconcileWithClient(
  service: SupabaseClient,
  now: Date
): Promise<SupportReconcileResult> {
  const { count, error: countError } = await service.from("support_tickets")
    .select("id", { count: "exact", head: true }).eq("status", "waiting_customer");
  if (countError) throw new Error("support_queue_count_unavailable");
  const window = supportScanWindow(count, now);
  if (!window.count) return { ok: true, scanned: 0, resolved: 0, escalated: 0, waiting: 0, failed: 0 };
  const { data, error } = await service
    .from("support_tickets")
    .select("id,user_id,site_id,category,diagnosis,created_at,updated_at")
    .eq("status", "waiting_customer")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(50)
    .range(window.offset, window.end);

  if (error) throw new Error("support_queue_unavailable");

  const tickets = (data || []) as WaitingTicket[];
  const diagnose = createSupportHealthDiagnoser(service);
  const cache = new Map<
    string,
    Awaited<ReturnType<typeof diagnoseSupportHealth>>
  >();

  let resolved = 0;
  let escalated = 0;
  let waiting = 0;
  let failed = 0;

  for (const ticket of tickets) {
    try {
      const cacheKey = `${ticket.user_id}:${ticket.site_id || "none"}`;
      let health = cache.get(cacheKey);
      if (!health) {
        health = await diagnose(
          ticket.user_id,
          ticket.site_id
        );
        cache.set(cacheKey, health);
      }

      const createdAt = Date.parse(ticket.created_at);
      const ageHours = Number.isFinite(createdAt)
        ? Math.max(0, (now.getTime() - createdAt) / (60 * 60 * 1000))
        : 72;

      const decision = supportReconcileDecision({
        overall: health.diagnosis.overall,
        clientAction: supportCustomerAction(ticket.category, health.diagnosis.checks),
        category: ticket.category,
        previousDiagnosis: ticket.diagnosis,
        checks: health.diagnosis.checks,
        ageHours
      });

      const patch: Record<string, unknown> = {
        status: decision.status,
        diagnosis: health.diagnosis,
        client_action: supportCustomerAction(ticket.category, health.diagnosis.checks),
        resolution_code: decision.resolutionCode,
        resolved_at: decision.resolved ? now.toISOString() : null,
        updated_at: now.toISOString()
      };
      if (decision.severity) patch.severity = decision.severity;

      const { data: updated, error: updateError } = await service
        .from("support_tickets")
        .update(patch)
        .eq("id", ticket.id)
        .eq("user_id", ticket.user_id)
        .eq("status", "waiting_customer")
        .eq("updated_at", ticket.updated_at)
        .select("id")
        .maybeSingle();

      if (updateError) throw new Error("support_ticket_update_failed");
      if (!updated) {
        continue;
      }

      const recorded = await recordSupportEvent(service, {
        ticketId: ticket.id,
        actor: "system",
        type: decision.resolved ? "resolution" : "diagnostic",
        metadata: {
          previous_status: "waiting_customer",
          status: decision.status,
          diagnosis: health.diagnosis.overall,
          resolution_code: decision.resolutionCode,
          age_hours: Math.round(ageHours)
        }
      });
      if (!recorded) throw new Error("support_ticket_event_unconfirmed");

      if (decision.status === "resolved") resolved++;
      else if (decision.status === "diagnosed") escalated++;
      else waiting++;
    } catch {
      failed++;
    }
  }

  return {
    ok: failed === 0,
    scanned: tickets.length,
    resolved,
    escalated,
    waiting,
    failed
  };
}

export async function runSupportReconciliationSafely(
  now = new Date(),
  serviceOverride?: SupabaseClient
): Promise<SupportReconcileResult> {
  if (serviceOverride) {
    try {
      return await reconcileWithClient(serviceOverride, now);
    } catch (error) {
      return {
        ok: false,
        scanned: 0,
        resolved: 0,
        escalated: 0,
        waiting: 0,
        failed: 1,
        error:
          error instanceof Error
            ? error.message
            : "support_reconciliation_failed"
      };
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return {
      ok: false,
      scanned: 0,
      resolved: 0,
      escalated: 0,
      waiting: 0,
      failed: 0,
      error: "support_reconciliation_not_configured"
    };
  }

  try {
    const service = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    return await reconcileWithClient(service, now);
  } catch (error) {
    return {
      ok: false,
      scanned: 0,
      resolved: 0,
      escalated: 0,
      waiting: 0,
      failed: 1,
      error:
        error instanceof Error
          ? error.message
          : "support_reconciliation_failed"
    };
  }
}
