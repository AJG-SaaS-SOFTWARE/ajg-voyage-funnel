import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const HOUR = 3_600_000;
const blocked = () => ({ decision: "blocked", lastCompletedAt: null, ageHours: null });

export function inspectBackupEvidence(payload, now = Date.now()) {
  if (!Number.isSafeInteger(now) || now < 0 || now > 8.64e15 ||
      !payload || payload.ok !== true || payload.configured !== true ||
      typeof payload.lastCompletedAt !== "string" || !payload.lastCompletedAt ||
      typeof payload.ageHours !== "number" || !Number.isFinite(payload.ageHours) || payload.ageHours < 0 ||
      !["healthy", "warning", "critical"].includes(payload.status)) return blocked();
  const completed = Date.parse(payload.lastCompletedAt);
  if (!Number.isFinite(completed) || completed > now) return blocked();
  const ageHours = (now - completed) / HOUR;
  // Public health rounds to 0.1h and can be cached for 60s. A 0.1h
  // consistency bound accommodates rounding/cache/transport, not future dates.
  if (Math.abs(ageHours - payload.ageHours) > 0.1 ||
      (payload.status === "healthy" && payload.ageHours > 36) ||
      (payload.status === "warning" && (payload.ageHours < 36 || payload.ageHours > 72)) ||
      (payload.status === "critical" && payload.ageHours < 72) ||
      (ageHours < 36 && payload.status !== "healthy")) return blocked();
  return {
    decision: ageHours >= 36 ? "recover" : "fresh",
    lastCompletedAt: new Date(completed).toISOString(),
    ageHours
  };
}

export function recoveredBackupEvidence(payload, previousCompleted, now = Date.now()) {
  if (typeof previousCompleted !== "string" || !previousCompleted) return false;
  const previous = Date.parse(previousCompleted);
  const evidence = inspectBackupEvidence(payload, now);
  return Number.isFinite(previous) && evidence.decision === "fresh" &&
    payload.status === "healthy" && Date.parse(evidence.lastCompletedAt) > previous;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [mode, file, previous] = process.argv.slice(2);
    const payload = JSON.parse(readFileSync(file, "utf8"));
    if (mode === "check") {
      const evidence = inspectBackupEvidence(payload);
      if (evidence.decision === "blocked") throw Error();
      // Only canonical timestamp and computed numeric/boolean fields reach
      // GITHUB_OUTPUT. Never echo source fields or a raw response on failure.
      console.log(`needs_recovery=${evidence.decision === "recover"}`);
      console.log(`last_completed_at=${evidence.lastCompletedAt}`);
      console.log(`age_hours=${evidence.ageHours}`);
    } else if (mode === "verify" && recoveredBackupEvidence(payload, previous)) {
      console.log("Backup recovery has a strictly newer, fresh completion.");
    } else throw Error();
  } catch {
    console.error("Backup evidence unconfirmed; no healthy or recovered state can be claimed.");
    process.exitCode = 1;
  }
}
