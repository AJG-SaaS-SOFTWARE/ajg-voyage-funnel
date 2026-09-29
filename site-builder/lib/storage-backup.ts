import "server-only";

import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  deletePrivateBlobs,
  listAllPrivateBlobs,
  listPrivateBlobs,
  privateBlobConfigured,
  putPrivateBlob,
  putPrivateJson,
  readPrivateJson
} from "./vercel-private-blob";
import {
  DEFAULT_STORAGE_BACKUP_RETENTION_DAYS,
  olderThanRetention,
  storageBackupFreshness,
  storageBackupObjectPath,
  storageBackupSnapshotPath
} from "./storage-backup-policy";

const STATE_PATH = "ajg-site-builder-backups/state.json";
const SNAPSHOT_PREFIX = "ajg-site-builder-backups/snapshots/";
const OBJECT_PREFIX = "ajg-site-builder-backups/objects/";
const BUCKETS = ["site-media", "site-private-media"] as const;

type BackupBucket = (typeof BUCKETS)[number];

type SourceObject = {
  bucket: BackupBucket;
  path: string;
  id: string | null;
  updatedAt: string | null;
  size: number | null;
  mimeType: string | null;
  etag: string | null;
  fingerprint: string;
};

type BackupVersion = {
  fingerprint: string;
  backupPath: string;
  backupUrl: string;
  sha256: string;
  size: number;
  mimeType: string | null;
  sourceUpdatedAt: string | null;
  backedUpAt: string;
  retiredAt?: string;
};

type BackupEntry = {
  bucket: BackupBucket;
  path: string;
  current: BackupVersion;
  previous: BackupVersion[];
  deletedAt?: string;
};

type BackupRunSummary = {
  sourceObjects: number;
  uploaded: number;
  unchanged: number;
  tombstoned: number;
  expiredVersionsPurged: number;
  oldSnapshotsPurged: number;
};

export type StorageBackupState = {
  version: 1;
  lastCompletedAt: string;
  retentionDays: number;
  entries: Record<string, BackupEntry>;
  lastRun: BackupRunSummary;
};

type BackupSnapshot = {
  version: 1;
  capturedAt: string;
  retentionDays: number;
  entries: Array<{
    bucket: BackupBucket;
    path: string;
    deletedAt?: string;
    current: BackupVersion;
    previous: BackupVersion[];
  }>;
  summary: BackupRunSummary;
};

function serviceConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  return { url, serviceKey };
}

function sourceKey(bucket: BackupBucket, path: string) {
  return `${bucket}:${path}`;
}

function sitePrefix(ownerId: string, siteId: string) {
  return `${ownerId}/${siteId}/`;
}

function safeMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string
) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

function safeMetadataNumber(
  metadata: Record<string, unknown> | null | undefined,
  key: string
) {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function makeFingerprint(input: {
  id: string | null;
  updatedAt: string | null;
  size: number | null;
  etag: string | null;
}) {
  return [
    input.id || "",
    input.updatedAt || "",
    input.size === null ? "" : String(input.size),
    input.etag || ""
  ].join("|");
}

async function walkBucket(
  service: SupabaseClient,
  bucket: BackupBucket,
  folder = ""
): Promise<SourceObject[]> {
  const out: SourceObject[] = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await service.storage
      .from(bucket)
      .list(folder, {
        limit: pageSize,
        offset,
        sortBy: { column: "name", order: "asc" }
      });

    if (error) {
      if (bucket === "site-private-media" && /not found|bucket/i.test(error.message || "")) {
        return out;
      }
      throw error;
    }

    const page = data || [];
    for (const item of page) {
      const path = folder ? `${folder}/${item.name}` : item.name;
      if (item.id) {
        const metadata = (item.metadata || null) as Record<string, unknown> | null;
        const updatedAt =
          (typeof item.updated_at === "string" && item.updated_at) ||
          (typeof item.created_at === "string" && item.created_at) ||
          null;
        const size =
          safeMetadataNumber(metadata, "size") ??
          safeMetadataNumber(metadata, "contentLength");
        const mimeType =
          safeMetadataString(metadata, "mimetype") ??
          safeMetadataString(metadata, "contentType");
        const etag =
          safeMetadataString(metadata, "eTag") ??
          safeMetadataString(metadata, "etag");

        out.push({
          bucket,
          path,
          id: item.id,
          updatedAt,
          size,
          mimeType,
          etag,
          fingerprint: makeFingerprint({
            id: item.id,
            updatedAt,
            size,
            etag
          })
        });
      } else {
        out.push(...await walkBucket(service, bucket, path));
      }
    }

    if (page.length < pageSize) break;
  }

  return out;
}

async function readBackupState(): Promise<StorageBackupState | null> {
  const listing = await listPrivateBlobs(STATE_PATH, 10);
  if (!listing.ok) {
    throw new Error(`backup_state_list_failed:${listing.status ?? "unknown"}`);
  }

  const exact = listing.data.blobs.find((blob) => blob.pathname === STATE_PATH);
  if (!exact) return null;

  const state = await readPrivateJson<StorageBackupState>(exact.url);
  if (!state.ok) {
    throw new Error(`backup_state_read_failed:${state.status ?? "unknown"}`);
  }

  return state.data;
}

async function uploadVersion(
  service: SupabaseClient,
  source: SourceObject,
  capturedAt: string
): Promise<BackupVersion> {
  const { data, error } = await service.storage
    .from(source.bucket)
    .download(source.path);

  if (error || !data) {
    throw new Error(
      `backup_download_failed:${source.bucket}:${source.path}:${error?.message || "missing data"}`
    );
  }

  const bytes = await data.arrayBuffer();
  const sha256 = createHash("sha256")
    .update(Buffer.from(bytes))
    .digest("hex");
  const backupPath = storageBackupObjectPath(
    source.bucket,
    source.path,
    capturedAt,
    sha256
  );
  const contentType = data.type || source.mimeType || "application/octet-stream";

  const stored = await putPrivateBlob(
    backupPath,
    bytes,
    contentType,
    false
  );

  if (!stored.ok) {
    throw new Error(
      `backup_blob_put_failed:${stored.status ?? "unknown"}:${stored.error}`
    );
  }

  return {
    fingerprint: source.fingerprint,
    backupPath: stored.data.pathname,
    backupUrl: stored.data.url,
    sha256,
    size: bytes.byteLength,
    mimeType: source.mimeType || data.type || null,
    sourceUpdatedAt: source.updatedAt,
    backedUpAt: capturedAt
  };
}

function allEntryUrls(entry: BackupEntry) {
  return [
    entry.current.backupUrl,
    ...entry.previous.map((version) => version.backupUrl)
  ];
}

async function deleteUrls(urls: string[]) {
  const unique = [...new Set(urls.filter(Boolean))];
  for (let index = 0; index < unique.length; index += 500) {
    const result = await deletePrivateBlobs(unique.slice(index, index + 500));
    if (!result.ok) {
      return {
        ok: false as const,
        error: result.error,
        status: result.status
      };
    }
  }
  return { ok: true as const };
}

async function pruneOldSnapshots(now: number, retentionDays: number) {
  const listing = await listAllPrivateBlobs(SNAPSHOT_PREFIX);
  if (!listing.ok) return 0;

  const expired = listing.data.blobs.filter((blob) =>
    olderThanRetention(blob.uploadedAt, now, retentionDays)
  );
  const result = await deleteUrls(expired.map((blob) => blob.url));
  return result.ok ? expired.length : 0;
}

export async function storageBackupConfigured() {
  const { url, serviceKey } = serviceConfig();
  return Boolean(url && serviceKey && await privateBlobConfigured());
}

export async function getStorageBackupStatus() {
  const configured = await storageBackupConfigured();
  if (!configured) {
    return {
      configured: false,
      status: "unknown" as const,
      lastCompletedAt: null,
      ageHours: null,
      sourceObjects: null,
      retentionDays: DEFAULT_STORAGE_BACKUP_RETENTION_DAYS
    };
  }

  const state = await readBackupState();
  const freshness = storageBackupFreshness(state?.lastCompletedAt);

  return {
    configured: true,
    status: freshness.status,
    lastCompletedAt: state?.lastCompletedAt ?? null,
    ageHours: freshness.ageHours,
    sourceObjects: state?.lastRun.sourceObjects ?? null,
    retentionDays:
      state?.retentionDays ?? DEFAULT_STORAGE_BACKUP_RETENTION_DAYS
  };
}

export async function runStorageBackup() {
  const { url, serviceKey } = serviceConfig();
  if (!url || !serviceKey || !(await privateBlobConfigured())) {
    return {
      ok: false as const,
      configured: false as const,
      reason:
        "Supabase server credentials and a private Vercel Blob store connection are required."
    };
  }

  const retentionDays = Math.max(
    7,
    Number(
      process.env.AJG_STORAGE_BACKUP_RETENTION_DAYS ||
        DEFAULT_STORAGE_BACKUP_RETENTION_DAYS
    ) || DEFAULT_STORAGE_BACKUP_RETENTION_DAYS
  );
  const capturedAt = new Date().toISOString();
  const now = Date.parse(capturedAt);
  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const [publicObjects, privateObjects] = await Promise.all([
    walkBucket(service, "site-media"),
    walkBucket(service, "site-private-media")
  ]);
  const sources = [...publicObjects, ...privateObjects];
  const previousState = await readBackupState();

  const entries: Record<string, BackupEntry> = {};
  const seen = new Set<string>();
  let uploaded = 0;
  let unchanged = 0;

  for (const source of sources) {
    const key = sourceKey(source.bucket, source.path);
    seen.add(key);
    const previous = previousState?.entries[key];

    if (
      previous &&
      previous.current.fingerprint === source.fingerprint
    ) {
      entries[key] = {
        ...previous,
        deletedAt: undefined
      };
      unchanged += 1;
      continue;
    }

    const nextVersion = await uploadVersion(service, source, capturedAt);
    uploaded += 1;

    entries[key] = {
      bucket: source.bucket,
      path: source.path,
      current: nextVersion,
      previous: previous
        ? [
            {
              ...previous.current,
              retiredAt: capturedAt
            },
            ...(previous.previous || [])
          ]
        : [],
      deletedAt: undefined
    };
  }

  for (const [key, previous] of Object.entries(previousState?.entries || {})) {
    if (seen.has(key)) continue;
    entries[key] = {
      ...previous,
      previous: previous.previous || [],
      deletedAt: previous.deletedAt || capturedAt
    };
  }

  const expiredUrls: string[] = [];
  const dropEntries = new Set<string>();
  const dropPrevious = new Map<string, Set<string>>();

  for (const [key, entry] of Object.entries(entries)) {
    if (
      entry.deletedAt &&
      olderThanRetention(entry.deletedAt, now, retentionDays)
    ) {
      expiredUrls.push(...allEntryUrls(entry));
      dropEntries.add(key);
      continue;
    }

    for (const version of entry.previous) {
      if (
        version.retiredAt &&
        olderThanRetention(version.retiredAt, now, retentionDays)
      ) {
        expiredUrls.push(version.backupUrl);
        const set = dropPrevious.get(key) || new Set<string>();
        set.add(version.backupUrl);
        dropPrevious.set(key, set);
      }
    }
  }

  let expiredVersionsPurged = 0;
  if (expiredUrls.length > 0) {
    const cleanup = await deleteUrls(expiredUrls);
    if (cleanup.ok) {
      expiredVersionsPurged = expiredUrls.length;
      for (const key of dropEntries) delete entries[key];
      for (const [key, urls] of dropPrevious) {
        if (!entries[key]) continue;
        entries[key].previous = entries[key].previous.filter(
          (version) => !urls.has(version.backupUrl)
        );
      }
    }
  }

  const tombstoned = Object.values(entries).filter(
    (entry) => Boolean(entry.deletedAt)
  ).length;

  const provisionalSummary: BackupRunSummary = {
    sourceObjects: sources.length,
    uploaded,
    unchanged,
    tombstoned,
    expiredVersionsPurged,
    oldSnapshotsPurged: 0
  };

  const snapshot: BackupSnapshot = {
    version: 1,
    capturedAt,
    retentionDays,
    entries: Object.values(entries),
    summary: provisionalSummary
  };
  const snapshotPath = storageBackupSnapshotPath(capturedAt);
  const snapshotWrite = await putPrivateJson(snapshotPath, snapshot, false);
  if (!snapshotWrite.ok) {
    throw new Error(
      `backup_snapshot_write_failed:${snapshotWrite.status ?? "unknown"}:${snapshotWrite.error}`
    );
  }

  const oldSnapshotsPurged = await pruneOldSnapshots(now, retentionDays);
  const lastRun: BackupRunSummary = {
    ...provisionalSummary,
    oldSnapshotsPurged
  };

  const state: StorageBackupState = {
    version: 1,
    lastCompletedAt: capturedAt,
    retentionDays,
    entries,
    lastRun
  };
  const stateWrite = await putPrivateJson(STATE_PATH, state, true);
  if (!stateWrite.ok) {
    throw new Error(
      `backup_state_write_failed:${stateWrite.status ?? "unknown"}:${stateWrite.error}`
    );
  }

  return {
    ok: true as const,
    configured: true as const,
    capturedAt,
    snapshotPath,
    summary: lastRun
  };
}

export async function purgeStorageBackupForSite(
  ownerId: string,
  siteId: string
) {
  if (!(await privateBlobConfigured())) {
    return {
      configured: false as const,
      deletedObjects: 0,
      rewrittenSnapshots: 0
    };
  }

  const prefix = sitePrefix(ownerId, siteId);
  const objectLists = await Promise.all(
    BUCKETS.map((bucket) =>
      listAllPrivateBlobs(`${OBJECT_PREFIX}${bucket}/${prefix}`)
    )
  );

  for (const result of objectLists) {
    if (!result.ok) {
      throw new Error(
        `backup_purge_list_failed:${result.status ?? "unknown"}:${result.error}`
      );
    }
  }

  const objectUrls = objectLists.flatMap((result) =>
    result.ok ? result.data.blobs.map((blob) => blob.url) : []
  );
  const deleteResult = await deleteUrls(objectUrls);
  if (!deleteResult.ok) {
    throw new Error(
      `backup_purge_delete_failed:${deleteResult.status ?? "unknown"}:${deleteResult.error}`
    );
  }

  const state = await readBackupState();
  if (state) {
    const entries = Object.fromEntries(
      Object.entries(state.entries).filter(([, entry]) =>
        !(
          (entry.bucket === "site-media" ||
            entry.bucket === "site-private-media") &&
          entry.path.startsWith(prefix)
        )
      )
    );
    const stateWrite = await putPrivateJson(
      STATE_PATH,
      { ...state, entries },
      true
    );
    if (!stateWrite.ok) {
      throw new Error(
        `backup_purge_state_failed:${stateWrite.status ?? "unknown"}:${stateWrite.error}`
      );
    }
  }

  const snapshots = await listAllPrivateBlobs(SNAPSHOT_PREFIX);
  if (!snapshots.ok) {
    throw new Error(
      `backup_purge_snapshots_failed:${snapshots.status ?? "unknown"}:${snapshots.error}`
    );
  }

  let rewrittenSnapshots = 0;
  for (const blob of snapshots.data.blobs) {
    const read = await readPrivateJson<BackupSnapshot>(blob.url);
    if (!read.ok) {
      throw new Error(
        `backup_purge_snapshot_read_failed:${read.status ?? "unknown"}`
      );
    }

    const filtered = read.data.entries.filter(
      (entry) => !entry.path.startsWith(prefix)
    );
    if (filtered.length === read.data.entries.length) continue;

    const write = await putPrivateJson(
      blob.pathname,
      { ...read.data, entries: filtered },
      true
    );
    if (!write.ok) {
      throw new Error(
        `backup_purge_snapshot_write_failed:${write.status ?? "unknown"}:${write.error}`
      );
    }
    rewrittenSnapshots += 1;
  }

  return {
    configured: true as const,
    deletedObjects: objectUrls.length,
    rewrittenSnapshots
  };
}
