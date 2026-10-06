import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSupportReconciliationSafely } from "./support-reconcile";
import { runSupportRemediationSweepSafely } from "./support-remediation-sweep";
import { getRecentRuntimeHealth } from "./vercel-runtime-health";
import { reportRuntimeIncidentToRun } from "./run-intake-reporting";
import { runPlatformSelfHealing } from "./platform-self-healing";

export type SupportOperationsAgentResult = {
  ok: boolean;
  runId: number | null;
  runStatus: "healthy" | "attention" | "failed";
  startedAt: string;
  completedAt: string;
  reconcile: Awaited<ReturnType<typeof runSupportReconciliationSafely>>;
  remediation: Awaited<ReturnType<typeof runSupportRemediationSweepSafely>>;
  platform: Awaited<ReturnType<typeof runPlatformSelfHealing>>;
  runtime: Awaited<ReturnType<typeof getRecentRuntimeHealth>>;
  reportedToRun: boolean;
  reportReason: string | null;
  errors: string[];
};

function statusFor(input: {
  reconcile: Awaited<ReturnType<typeof runSupportReconciliationSafely>>;
  remediation: Awaited<ReturnType<typeof runSupportRemediationSweepSafely>>;
  platform: Awaited<ReturnType<typeof runPlatformSelfHealing>>;
  runtime: Awaited<ReturnType<typeof getRecentRuntimeHealth>>;
}) {
  if (!input.reconcile.ok || !input.remediation.ok || input.platform.status === "failed") return "failed" as const;
  if (
    input.runtime.status === "incident" ||
    input.platform.status === "attention" ||
    input.reconcile.failed > 0 ||
    input.remediation.failed > 0
  ) return "attention" as const;
  return "healthy" as const;
}

export async function runSupportOperationsAgent(
  service: SupabaseClient,
  now = new Date()
): Promise<SupportOperationsAgentResult> {
  const startedAt = now.toISOString();
  const { data: run, error: runError } = await service
    .from("support_operations_runs")
    .insert({ started_at: startedAt, status: "running" })
    .select("id")
    .single();
  if (runError || !run) throw runError || new Error("support_operations_journal_unavailable");

  try {
    const platform = await runPlatformSelfHealing(service);
    const [reconcile, remediation, runtime] = await Promise.all([
      runSupportReconciliationSafely(now),
      runSupportRemediationSweepSafely(now),
      getRecentRuntimeHealth()
    ]);

    const errors = [
      reconcile.error ? `reconcile:${reconcile.error}` : null,
      remediation.error ? `remediation:${remediation.error}` : null,
      ...platform.actions
        .filter((action) => action.status === "failed")
        .map((action) => `platform:${action.action}:${action.code}`)
    ].filter((value): value is string => Boolean(value));

    const report = await reportRuntimeIncidentToRun({
      deploymentId: runtime.deploymentId,
      runtimeStatus: runtime.status,
      errorCount: runtime.errorCount,
      fatalCount: runtime.fatalCount,
      http5xxCount: runtime.http5xxCount,
      source: "builder-support-operations"
    });

    const runStatus = statusFor({ reconcile, remediation, platform, runtime });
    const completedAt = new Date().toISOString();
    const reportReason =
      runtime.status === "incident"
        ? report.ok
          ? "runtime_incident_reported"
          : "runtime_incident_reporting_failed"
        : null;

    if (!report.ok && runtime.status === "incident") {
      errors.push(`run_reporting:${"reason" in report ? report.reason : "unknown"}`);
    }

    const { error: updateError } = await service
      .from("support_operations_runs")
      .update({
        completed_at: completedAt,
        status: runStatus,
        reconcile_scanned: reconcile.scanned,
        reconcile_resolved: reconcile.resolved,
        reconcile_escalated: reconcile.escalated,
        reconcile_waiting: reconcile.waiting,
        reconcile_failed: reconcile.failed,
        remediation_scanned: remediation.scanned,
        remediation_eligible: remediation.eligible,
        remediation_attempted: remediation.attempted,
        remediation_succeeded: remediation.succeeded,
        remediation_no_change: remediation.noChange,
        remediation_failed: remediation.failed,
        platform_status: platform.status,
        platform_repaired: platform.repaired,
        platform_failed: platform.failed,
        platform_actions: platform.actions,
        backup_status_after: platform.backupStatusAfter,
        runtime_status: runtime.status,
        runtime_error_count: runtime.errorCount,
        runtime_fatal_count: runtime.fatalCount,
        runtime_http5xx_count: runtime.http5xxCount,
        runtime_deployment_id: runtime.deploymentId,
        reported_to_run: report.ok && runtime.status === "incident",
        report_reason: reportReason,
        errors
      })
      .eq("id", run.id);
    if (updateError) throw updateError;

    return {
      ok: runStatus !== "failed",
      runId: run.id as number,
      runStatus,
      startedAt,
      completedAt,
      reconcile,
      remediation,
      platform,
      runtime,
      reportedToRun: report.ok && runtime.status === "incident",
      reportReason,
      errors
    };
  } catch (error) {
    const completedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : "support_operations_failed";
    await service
      .from("support_operations_runs")
      .update({
        completed_at: completedAt,
        status: "failed",
        errors: [message]
      })
      .eq("id", run.id);
    throw error;
  }
}

export async function runSupportOperationsAgentFromEnvironment() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return {
      ok: false,
      runId: null,
      runStatus: "failed" as const,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      reconcile: { ok: false, scanned: 0, resolved: 0, escalated: 0, waiting: 0, failed: 0, error: "not_configured" },
      remediation: { ok: false, scanned: 0, eligible: 0, attempted: 0, succeeded: 0, noChange: 0, failed: 0, skippedCooldown: 0, skippedCustomDomain: 0, skippedAmbiguous: 0, error: "not_configured" },
      platform: { ok: false, status: "failed" as const, repaired: 0, failed: 1, actions: [], backupStatusAfter: null },
      runtime: { checked: false, deploymentId: null, lookbackMinutes: 60, sampledLogs: 0, errorCount: 0, fatalCount: 0, http5xxCount: 0, truncated: false, status: "unknown" as const },
      reportedToRun: false,
      reportReason: "not_configured",
      errors: ["support_operations_not_configured"]
    };
  }
  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return runSupportOperationsAgent(service);
}
