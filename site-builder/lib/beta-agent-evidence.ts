type BetaRun = {
  status: string;
  completed_at: string | null;
  repair_failures: number | null;
  follow_up_candidates: number | null;
  unresponsive_after_followup: number | null;
};

// Daily at 07:05 UTC in vercel.json. One daily period plus twelve hours of
// tolerance is an observation policy, not a delivery/SLA guarantee or retry.
const maximumAgeMs = 36 * 60 * 60 * 1000;

export function betaAgentEvidence(run: BetaRun, now = new Date()) {
  if (run.status === "failed") return { status: "failed", evidence: "failed" } as const;
  if (run.status !== "healthy" && run.status !== "attention") {
    return { status: "attention", evidence: "incomplete" } as const;
  }
  const completedAt = run.completed_at ? Date.parse(run.completed_at) : NaN;
  const age = now.getTime() - completedAt;
  if (!Number.isFinite(age) || age < 0) {
    return { status: "attention", evidence: "invalid" } as const;
  }
  if (age > maximumAgeMs) return { status: "attention", evidence: "stale" } as const;

  const counters = [run.repair_failures, run.follow_up_candidates, run.unresponsive_after_followup];
  if (counters.some(value => typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)) {
    return { status: "attention", evidence: "invalid" } as const;
  }
  if (run.repair_failures !== 0) {
    return { status: "attention", evidence: "inconsistent" } as const;
  }
  if (run.status === "attention" || run.follow_up_candidates !== 0 || run.unresponsive_after_followup !== 0) {
    return { status: "attention", evidence: "follow_up_required" } as const;
  }
  return { status: "healthy", evidence: "confirmed" } as const;
}
