import { createHmac } from "node:crypto";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return "{" + Object.keys(object).sort().map(key => JSON.stringify(key) + ":" + canonical(object[key])).join(",") + "}";
  }
  return JSON.stringify(value) ?? "null";
}

export function aiRequestHashes(body: unknown, userId: string, siteId: string, key: string | null, secret: string) {
  if (key !== null && (!key.trim() || key.length > 128)) throw new Error("invalid_idempotency_key");
  const digest = (value: string) => createHmac("sha256", secret).update(value).digest("hex");
  return {
    fingerprint: digest(canonical({ body, userId, siteId })),
    keyHash: key === null ? null : digest(userId + ":" + key)
  };
}
