export function supportAgentStatus(run: {
  status: string;
  completed_at: string | null;
  runtime_status: string | null;
}, now = new Date()) {
  if (run.status === "failed") return "failed" as const;
  const completedAt = run.completed_at ? Date.parse(run.completed_at) : NaN;
  const age = now.getTime() - completedAt;
  // The scheduled cycle runs hourly; allow up to two delayed cycles.
  return run.status === "healthy" && Number.isFinite(age) && age >= 0 &&
      age <= 3 * 60 * 60 * 1000 && run.runtime_status === "healthy"
    ? "healthy" as const
    : "attention" as const;
}
