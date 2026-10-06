import type { SupabaseClient } from "@supabase/supabase-js";
import { ensurePrivateStorageBucket } from "./storage-bootstrap";
import { getStorageBackupStatus, runStorageBackup } from "./storage-backup";

export type PlatformSelfHealingAction = {
  action: "private_storage_bootstrap" | "storage_backup_refresh";
  status: "succeeded" | "no_change" | "failed";
  code: string;
};

export type PlatformSelfHealingResult = {
  ok: boolean;
  status: "healthy" | "attention" | "failed";
  repaired: number;
  failed: number;
  actions: PlatformSelfHealingAction[];
  backupStatusAfter: string | null;
};

export async function runPlatformSelfHealing(
  service: SupabaseClient
): Promise<PlatformSelfHealingResult> {
  const actions: PlatformSelfHealingAction[] = [];
  let repaired = 0;
  let failed = 0;

  const storage = await ensurePrivateStorageBucket(service);
  if (!storage.ok) {
    failed += 1;
    actions.push({
      action: "private_storage_bootstrap",
      status: "failed",
      code: storage.code
    });
  } else {
    if (storage.created) repaired += 1;
    actions.push({
      action: "private_storage_bootstrap",
      status: storage.created ? "succeeded" : "no_change",
      code: storage.created ? "private_bucket_created_and_verified" : "private_bucket_healthy"
    });
  }

  let backupStatusAfter: string | null = null;
  try {
    const before = await getStorageBackupStatus();
    if (before.configured && (before.status === "warning" || before.status === "critical")) {
      const backup = await runStorageBackup();
      if (backup.ok) {
        const after = await getStorageBackupStatus();
        backupStatusAfter = after.status;
        if (after.status === "healthy") {
          repaired += 1;
          actions.push({
            action: "storage_backup_refresh",
            status: "succeeded",
            code: "backup_refreshed_and_verified"
          });
        } else {
          failed += 1;
          actions.push({
            action: "storage_backup_refresh",
            status: "failed",
            code: "backup_refresh_not_healthy"
          });
        }
      } else {
        failed += 1;
        actions.push({
          action: "storage_backup_refresh",
          status: "failed",
          code: backup.configured ? "backup_refresh_failed" : "backup_store_not_configured"
        });
      }
    } else {
      backupStatusAfter = before.status;
      actions.push({
        action: "storage_backup_refresh",
        status: "no_change",
        code: before.configured ? "backup_fresh" : "backup_store_not_configured"
      });
    }
  } catch {
    failed += 1;
    actions.push({
      action: "storage_backup_refresh",
      status: "failed",
      code: "backup_health_unavailable"
    });
  }

  const status =
    failed > 0 ? (repaired > 0 ? "attention" : "failed") : "healthy";

  return {
    ok: status !== "failed",
    status,
    repaired,
    failed,
    actions,
    backupStatusAfter
  };
}
