import type { SupportDiagnosis } from "./support-diagnostics";

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const statuses = ["healthy", "action", "incident"];
const keys = new Set(["backend", "publication", "public_render", "latency", "seo", "sitemap",
  "domain", "billing", "backup", "ai", "contact", "images", "content_links", "storage"]);

// This validates display evidence only. It grants no repair or account rights.
export function readPostPublishDiagnosis(body: unknown, siteId: string): SupportDiagnosis | null {
  if (!siteId || !record(body) || !record(body.health) || body.health.siteId !== siteId ||
      !record(body.health.diagnosis)) return null;
  const diagnosis = body.health.diagnosis;
  if (typeof diagnosis.overall !== "string" || !statuses.includes(diagnosis.overall) ||
      !Array.isArray(diagnosis.checks) || !diagnosis.checks.length || diagnosis.checks.length > keys.size ||
      !(diagnosis.clientAction === null || typeof diagnosis.clientAction === "string") ||
      !Array.isArray(diagnosis.repairActions) || diagnosis.repairActions.length > 1 ||
      diagnosis.repairActions.some(action => action !== "managed_domain_repair") ||
      typeof diagnosis.generatedAt !== "string" || !Number.isFinite(Date.parse(diagnosis.generatedAt))) return null;

  const seen = new Set<string>();
  let strongest = 0;
  for (const check of diagnosis.checks) {
    if (!record(check) || typeof check.key !== "string" || !keys.has(check.key) || seen.has(check.key) ||
        typeof check.status !== "string" || !statuses.includes(check.status) ||
        typeof check.label !== "string" || !check.label.trim() ||
        typeof check.detail !== "string" || !check.detail.trim() ||
        !(check.clientAction === undefined || typeof check.clientAction === "string")) return null;
    seen.add(check.key);
    strongest = Math.max(strongest, statuses.indexOf(check.status));
  }
  if (statuses[strongest] !== diagnosis.overall ||
      !["backend", "publication", "domain", "billing"].every(key => seen.has(key)) ||
      (diagnosis.overall === "healthy" && !seen.has("public_render"))) return null;
  return diagnosis as SupportDiagnosis;
}
