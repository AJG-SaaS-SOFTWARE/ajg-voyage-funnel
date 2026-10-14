import { timingSafeEqual } from "node:crypto";
import { aiRequestHashes } from "./ai-request-admission.ts";

const TTL_MS = 2 * 60 * 60 * 1000;
type Scope = { userId: string; siteId: string; source: unknown };

function digest(scope: Scope, strategy: unknown, expiresAt: number, secret: string) {
  return aiRequestHashes({ version: "premium-strategy-v1", expiresAt,
    source: scope.source, strategy }, scope.userId, scope.siteId, null, secret).fingerprint;
}

export function issueStrategyReuseToken(scope: Scope, strategy: unknown, secret: string, now = Date.now()) {
  const expiresAt = now + TTL_MS;
  if (!secret || !scope.userId || !scope.siteId || !Number.isSafeInteger(expiresAt)) throw new Error("invalid_strategy_reuse_scope");
  return `${expiresAt}.${digest(scope, strategy, expiresAt, secret)}`;
}

export function verifyStrategyReuseToken(scope: Scope, strategy: unknown, token: unknown, secret: string, now = Date.now()) {
  if (!secret || !scope.userId || !scope.siteId || typeof token !== "string") return false;
  const match = /^(\d{13})\.([a-f0-9]{64})$/.exec(token);
  if (!match) return false;
  const expiresAt = Number(match[1]);
  if (!Number.isSafeInteger(expiresAt) || !Number.isFinite(now) || now >= expiresAt || expiresAt > now + TTL_MS) return false;
  return timingSafeEqual(Buffer.from(match[2], "hex"), Buffer.from(digest(scope, strategy, expiresAt, secret), "hex"));
}
