export const DEFAULT_STORAGE_BACKUP_RETENTION_DAYS = 35;

export type BackupFreshness = "healthy" | "warning" | "critical" | "unknown";

export function storageBackupObjectPath(
  bucket: string,
  sourcePath: string,
  capturedAt: string,
  sha256: string
) {
  const stamp = capturedAt.replace(/[:.]/g, "-");
  return `ajg-site-builder-backups/objects/${bucket}/${sourcePath}/versions/${stamp}-${sha256}`;
}

export function storageBackupSnapshotPath(capturedAt: string) {
  const date = capturedAt.slice(0, 10);
  const stamp = capturedAt.replace(/[:.]/g, "-");
  return `ajg-site-builder-backups/snapshots/${date}/${stamp}.json`;
}

export function olderThanRetention(
  value: string,
  now: number,
  retentionDays = DEFAULT_STORAGE_BACKUP_RETENTION_DAYS
) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;
  return now - timestamp > retentionDays * 24 * 60 * 60 * 1000;
}

export function storageBackupFreshness(
  lastCompletedAt: string | undefined,
  now = Date.now()
): {
  status: BackupFreshness;
  ageHours: number | null;
} {
  if (!lastCompletedAt) {
    return { status: "unknown", ageHours: null };
  }

  const timestamp = Date.parse(lastCompletedAt);
  if (!Number.isFinite(timestamp)) {
    return { status: "unknown", ageHours: null };
  }

  const ageHours = Math.max(0, (now - timestamp) / (60 * 60 * 1000));
  return {
    status: ageHours <= 36 ? "healthy" : ageHours <= 72 ? "warning" : "critical",
    ageHours
  };
}
