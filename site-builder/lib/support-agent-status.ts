export function supportAgentStatus(run: {
  status: string;
  completed_at: string | null;
  runtime_status: string | null;
}) {
  if (run.status === "failed") return "failed" as const;
  return run.status === "healthy" && run.completed_at && run.runtime_status === "healthy"
    ? "healthy" as const
    : "attention" as const;
}
