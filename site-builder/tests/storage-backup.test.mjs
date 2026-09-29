import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_STORAGE_BACKUP_RETENTION_DAYS,
  olderThanRetention,
  storageBackupFreshness,
  storageBackupObjectPath,
  storageBackupSnapshotPath
} from "../lib/storage-backup-policy.ts";

test("backup object paths preserve source ownership scope and content hash", () => {
  const path = storageBackupObjectPath(
    "site-private-media",
    "owner-1/site-1/library/file.pdf",
    "2026-09-29T15:00:00.000Z",
    "abc123"
  );

  assert.equal(
    path,
    "ajg-site-builder-backups/objects/site-private-media/owner-1/site-1/library/file.pdf/versions/2026-09-29T15-00-00-000Z-abc123"
  );
});

test("snapshot paths are date-partitioned", () => {
  assert.equal(
    storageBackupSnapshotPath("2026-09-29T15:00:00.000Z"),
    "ajg-site-builder-backups/snapshots/2026-09-29/2026-09-29T15-00-00-000Z.json"
  );
});

test("backup freshness warns after 36h and becomes critical after 72h", () => {
  const now = Date.parse("2026-09-29T15:00:00.000Z");
  assert.equal(
    storageBackupFreshness("2026-09-28T15:00:00.000Z", now).status,
    "healthy"
  );
  assert.equal(
    storageBackupFreshness("2026-09-27T15:00:00.000Z", now).status,
    "warning"
  );
  assert.equal(
    storageBackupFreshness("2026-09-25T15:00:00.000Z", now).status,
    "critical"
  );
});

test("retention defaults to 35 days", () => {
  const now = Date.parse("2026-09-29T15:00:00.000Z");
  assert.equal(DEFAULT_STORAGE_BACKUP_RETENTION_DAYS, 35);
  assert.equal(
    olderThanRetention("2026-08-20T15:00:00.000Z", now),
    true
  );
  assert.equal(
    olderThanRetention("2026-09-20T15:00:00.000Z", now),
    false
  );
});
