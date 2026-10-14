// Keep each run bounded, but rotate the window instead of inspecting the same
// first rows forever. Coverage assumes stable membership and hourly executions.
export function supportScanWindow(count: number | null, now: Date, batchSize = 50) {
  if (!Number.isSafeInteger(count) || count === null || count < 0 ||
    !Number.isSafeInteger(batchSize) || batchSize <= 0 || !Number.isFinite(now.getTime()) || now.getTime() < 0) {
    throw new Error("support_scan_count_unavailable");
  }
  const windows = Math.max(1, Math.ceil(count / batchSize));
  const hour = Math.floor(now.getTime() / 3_600_000);
  const offset = (hour % windows) * batchSize;
  return { offset, end: Math.min(count, offset + batchSize) - 1, count, cycle: Math.floor(hour / windows) };
}
