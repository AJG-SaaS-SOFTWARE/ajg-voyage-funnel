import type { SupabaseClient } from "@supabase/supabase-js";

export type PrivateStorageBootstrapResult =
  | { ok: true; created: boolean; bucket: "site-private-media" }
  | { ok: false; code: string };

const PRIVATE_BUCKET = "site-private-media";

export async function ensurePrivateStorageBucket(
  service: SupabaseClient
): Promise<PrivateStorageBootstrapResult> {
  const { data: existing, error: getError } = await service.storage.getBucket(PRIVATE_BUCKET);

  if (existing) {
    if (existing.public) {
      const { error: updateError } = await service.storage.updateBucket(PRIVATE_BUCKET, {
        public: false,
        allowedMimeTypes: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/avif",
          "audio/mpeg",
          "audio/mp4",
          "audio/ogg",
          "audio/wav",
          "application/pdf",
          "text/plain"
        ],
        fileSizeLimit: "15MB"
      });
      if (updateError) return { ok: false, code: "private_bucket_visibility_repair_failed" };
      const { data: verified, error: verifyError } = await service.storage.getBucket(PRIVATE_BUCKET);
      return verified && !verifyError && verified.public === false
        ? { ok: true, created: false, bucket: PRIVATE_BUCKET }
        : { ok: false, code: "private_bucket_verification_failed" };
    }
    return { ok: true, created: false, bucket: PRIVATE_BUCKET };
  }

  if (getError && !/not found/i.test(getError.message || "")) {
    const { data: buckets, error: listError } = await service.storage.listBuckets();
    if (listError) return { ok: false, code: "storage_inspection_failed" };
    if (buckets?.some((bucket) => bucket.id === PRIVATE_BUCKET)) {
      const { data: racedBucket } = await service.storage.getBucket(PRIVATE_BUCKET);
      if (!racedBucket) return { ok: false, code: "private_bucket_unavailable" };
      if (racedBucket.public) {
        const { error: updateError } = await service.storage.updateBucket(PRIVATE_BUCKET, {
          public: false,
          allowedMimeTypes: [
            "image/jpeg","image/png","image/webp","image/avif",
            "audio/mpeg","audio/mp4","audio/ogg","audio/wav",
            "application/pdf","text/plain"
          ],
          fileSizeLimit: "15MB"
        });
        if (updateError) return { ok: false, code: "private_bucket_visibility_repair_failed" };
      }
      return { ok: true, created: false, bucket: PRIVATE_BUCKET };
    }
  }

  const { error: createError } = await service.storage.createBucket(PRIVATE_BUCKET, {
    public: false,
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif",
      "audio/mpeg",
      "audio/mp4",
      "audio/ogg",
      "audio/wav",
      "application/pdf",
      "text/plain"
    ],
    fileSizeLimit: "15MB"
  });

  if (createError) {
    const { data: racedBucket } = await service.storage.getBucket(PRIVATE_BUCKET);
    if (!racedBucket) return { ok: false, code: "private_bucket_create_failed" };
  }

  const { data: verified, error: verifyError } = await service.storage.getBucket(PRIVATE_BUCKET);
  if (verifyError || !verified || verified.public) {
    return { ok: false, code: "private_bucket_verification_failed" };
  }

  return { ok: true, created: true, bucket: PRIVATE_BUCKET };
}
