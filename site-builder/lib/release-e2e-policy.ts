export type ReleaseE2ERunSnapshot = {
  status: string;
  completed_at: string | null;
};

export const RELEASE_E2E_MAX_FAILURES_PER_LOCALE = 3;
export const RELEASE_E2E_RETRY_COOLDOWN_MS = 6 * 60 * 60 * 1000;

export function releaseE2ERunDecision(
  rows: ReleaseE2ERunSnapshot[],
  now = Date.now()
) {
  if (rows.some((row) => row.status === "success")) {
    return { run: false, reason: "already_validated" as const };
  }

  const failures = rows.filter((row) =>
    ["failed", "cleanup_failed"].includes(row.status)
  );

  if (failures.length >= RELEASE_E2E_MAX_FAILURES_PER_LOCALE) {
    return { run: false, reason: "retry_budget_exhausted" as const };
  }

  const latestFailure = failures
    .map((row) => row.completed_at)
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value))
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];

  if (
    latestFailure &&
    now - latestFailure < RELEASE_E2E_RETRY_COOLDOWN_MS
  ) {
    return { run: false, reason: "cooldown" as const };
  }

  return { run: true, reason: "missing_validation" as const };
}
