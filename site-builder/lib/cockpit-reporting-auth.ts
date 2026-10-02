import { timingSafeEqual } from "node:crypto";

// Server reporting contract shared by AJG products. Never use a public env key.
export function authorizedReportingRequest(
  authorization: string | null,
  expectedToken: string | undefined
): boolean {
  const expected = expectedToken?.trim() ?? "";
  if (expected.length < 32 || !authorization?.startsWith("Bearer ")) return false;
  const supplied = authorization.slice("Bearer ".length);
  // Reject additional whitespace and tokens instead of normalizing credentials.
  if (!supplied || supplied !== supplied.trim()) return false;
  const left = Buffer.from(supplied, "utf8");
  const right = Buffer.from(expected, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

