import type { SupportCheck, SupportCheckStatus } from "./support-diagnostics";

export type GrowthHealthGroupKey = "availability" | "visibility" | "content" | "operations";

export type GrowthHealthGroup = {
  key: GrowthHealthGroupKey;
  checks: SupportCheck[];
  status: SupportCheckStatus;
};

const groupByCheck: Record<SupportCheck["key"], GrowthHealthGroupKey> = {
  backend: "availability",
  publication: "availability",
  public_render: "availability",
  latency: "availability",
  domain: "availability",
  seo: "visibility",
  sitemap: "visibility",
  content_links: "visibility",
  contact: "content",
  images: "content",
  storage: "operations",
  backup: "operations",
  billing: "operations",
  ai: "operations"
};

const priority: Record<SupportCheckStatus, number> = {
  healthy: 0,
  action: 1,
  incident: 2
};

function strongest(checks: SupportCheck[]): SupportCheckStatus {
  return checks.reduce<SupportCheckStatus>(
    (current, check) => priority[check.status] > priority[current] ? check.status : current,
    "healthy"
  );
}

export function growthHealthCounts(checks: SupportCheck[]) {
  return checks.reduce(
    (result, check) => {
      result[check.status] += 1;
      return result;
    },
    { healthy: 0, action: 0, incident: 0 }
  );
}

export function groupGrowthHealthChecks(checks: SupportCheck[]): GrowthHealthGroup[] {
  const order: GrowthHealthGroupKey[] = ["availability", "visibility", "content", "operations"];
  return order.map((key) => {
    const grouped = checks.filter((check) => groupByCheck[check.key] === key);
    return { key, checks: grouped, status: strongest(grouped) };
  }).filter((group) => group.checks.length > 0);
}
