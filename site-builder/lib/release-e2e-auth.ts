import { createHash, timingSafeEqual } from "node:crypto";

function secureEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function releaseE2EAuthorized(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (!token) return false;

  const cronSecret = process.env.CRON_SECRET || "";
  if (cronSecret && secureEqual(token, cronSecret)) return true;

  const expectedHash = (process.env.AJG_RELEASE_E2E_TOKEN_HASH || "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) return false;

  const actualHash = createHash("sha256").update(token).digest("hex");
  return secureEqual(actualHash, expectedHash);
}
