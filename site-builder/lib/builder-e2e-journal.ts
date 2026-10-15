import type { SupabaseClient } from "@supabase/supabase-js";

export function validBuilderE2ERunId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

// An error-free UPDATE can affect zero rows. Require the matching terminal row
// before the recipe can claim that its evidence has been persisted.
export async function finishBuilderE2EJournal(
  service: SupabaseClient,
  runId: number,
  patch: {
    status: "success" | "failed" | "cleanup_failed";
    completed_at: string;
    failure_stage: string | null;
    detail: string | null;
    steps: unknown[];
  }
) {
  if (!validBuilderE2ERunId(runId)) return { error: "invalid_journal_run_id" };
  try {
    const { data, error } = await service.from("builder_e2e_runs")
      .update(patch).eq("id", runId).eq("status", "running")
      .select("id,status,completed_at").single();
    if (error || data?.id !== runId || data?.status !== patch.status ||
      typeof data?.completed_at !== "string" ||
      !Number.isFinite(Date.parse(patch.completed_at)) ||
      Date.parse(data.completed_at) !== Date.parse(patch.completed_at)) {
      return { error: "journal_completion_unconfirmed" };
    }
    return { error: null };
  } catch {
    // A transport failure is an uncertain write, never a reason to repeat it.
    return { error: "journal_completion_unconfirmed" };
  }
}
