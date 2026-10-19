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

const freshnessNow = Date.parse("2026-10-19T20:00:00.000Z");
for (const stamp of ["2026-10-19T20:00:00.001Z", "2027-10-19T20:00:00.000Z",
  1, true, {}, ["2026-10-19T20:00:00.000Z"]]) {
  test(`backup freshness never treats future or non-string evidence as healthy: ${JSON.stringify(stamp)}`, () => {
    assert.deepEqual(storageBackupFreshness(stamp, freshnessNow), { status: "unknown", ageHours: null });
  });
}

for (const clock of [NaN, Infinity, -Infinity, -1, freshnessNow + 0.5, 8.64e15 + 1, "2026-10-19", null]) {
  test(`backup freshness refuses an invalid observation clock: ${clock}`, () => {
    assert.deepEqual(storageBackupFreshness("2026-10-19T20:00:00.000Z", clock), { status: "unknown", ageHours: null });
  });
}

test("freshness boundaries retain the existing exact 36h and 72h contract", () => {
  for (const [age, status] of [[0, "healthy"], [36 * 3_600_000, "healthy"],
    [36 * 3_600_000 + 1, "warning"], [72 * 3_600_000, "warning"], [72 * 3_600_000 + 1, "critical"]]) {
    const result = storageBackupFreshness(new Date(freshnessNow - age).toISOString(), freshnessNow);
    assert.equal(result.status, status);
    assert.equal(result.ageHours, age / 3_600_000);
  }
  assert.deepEqual(storageBackupFreshness(undefined, freshnessNow), { status: "unknown", ageHours: null });
  assert.deepEqual(storageBackupFreshness("invalid", freshnessNow), { status: "unknown", ageHours: null });
});
