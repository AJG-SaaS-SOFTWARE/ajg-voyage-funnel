import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { diagnoseSupportHealth } from "./support-health-server";
import { supportReconcileDecision } from "./support-reconcile-policy";

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
};

async function reconcileWithClient(
  service: SupabaseClient,
  now: Date
): Promise<SupportReconcileResult> {
  const { data, error } = await service
    .from("support_tickets")
    .select("id,user_id,site_id,created_at")
    .eq("status", "waiting_customer")
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) throw new Error("support_queue_unavailable");

  const tickets = (data || []) as WaitingTicket[];
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
        health = await diagnoseSupportHealth(
          service,
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
        clientAction: health.diagnosis.clientAction,
        ageHours
      });

      const patch: Record<string, unknown> = {
        status: decision.status,
        diagnosis: health.diagnosis,
        client_action: health.diagnosis.clientAction,
        resolution_code: decision.resolutionCode,
        resolved_at: decision.resolved ? now.toISOString() : null,
        updated_at: now.toISOString()
      };
      if (decision.severity) patch.severity = decision.severity;

      const { data: updated, error: updateError } = await service
        .from("support_tickets")
        .update(patch)
        .eq("id", ticket.id)
        .eq("status", "waiting_customer")
        .select("id")
        .maybeSingle();

      if (updateError) throw new Error("support_ticket_update_failed");
      if (!updated) {
        continue;
      }

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
  now = new Date()
): Promise<SupportReconcileResult> {
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
