import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSupportRepair } from "./support-remediation";

const MAX_SCAN = 50;
const MAX_REPAIRS = 10;
const COOLDOWN_HOURS = 6;

export type SupportRemediationSweepResult = {
  ok: boolean;
  scanned: number;
  eligible: number;
  attempted: number;
  succeeded: number;
  noChange: number;
  failed: number;
  skippedCooldown: number;
  skippedCustomDomain: number;
  skippedAmbiguous: number;
  error?: string;
};

type CandidateSite = {
  id: string;
  owner_id: string;
};

type DomainRow = {
  site_id: string;
  kind: string;
  verification_status: string;
  is_primary: boolean;
};

function emptyResult(): SupportRemediationSweepResult {
  return {
    ok: true,
    scanned: 0,
    eligible: 0,
    attempted: 0,
    succeeded: 0,
    noChange: 0,
    failed: 0,
    skippedCooldown: 0,
    skippedCustomDomain: 0,
    skippedAmbiguous: 0
  };
}

async function sweepWithClient(
  service: SupabaseClient,
  now: Date
): Promise<SupportRemediationSweepResult> {
  const result = emptyResult();

  const { data: siteRows, error: siteError } = await service
    .from("sites")
    .select("id,owner_id")
    .eq("status", "published")
    .eq("privacy_state", "active")
    .order("updated_at", { ascending: true })
    .limit(MAX_SCAN);

  if (siteError) throw new Error("remediation_sites_unavailable");

  const sites = (siteRows || []) as CandidateSite[];
  result.scanned = sites.length;
  if (!sites.length) return result;

  const siteIds = sites.map((site) => site.id);
  const cooldownSince = new Date(
    now.getTime() - COOLDOWN_HOURS * 60 * 60 * 1000
  ).toISOString();

  const [
    { data: domainRows, error: domainError },
    { data: recentRows, error: recentError }
  ] = await Promise.all([
    service
      .from("domains")
      .select("site_id,kind,verification_status,is_primary")
      .in("site_id", siteIds),
    service
      .from("support_remediation_runs")
      .select("site_id")
      .eq("action", "managed_domain_repair")
      .gte("created_at", cooldownSince)
      .in("site_id", siteIds)
  ]);

  if (domainError) throw new Error("remediation_domains_unavailable");
  if (recentError) throw new Error("remediation_cooldown_unavailable");

  const domains = (domainRows || []) as DomainRow[];
  const recentSites = new Set(
    (recentRows || []).map((row: any) => String(row.site_id))
  );

  const eligible: CandidateSite[] = [];

  for (const site of sites) {
    const siteDomains = domains.filter((domain) => domain.site_id === site.id);
    const customDomains = siteDomains.filter(
      (domain) => domain.kind === "custom_domain"
    );
    if (customDomains.length) {
      result.skippedCustomDomain++;
      continue;
    }

    const managedDomains = siteDomains.filter(
      (domain) => domain.kind === "managed_subdomain"
    );
    if (managedDomains.length > 1) {
      result.skippedAmbiguous++;
      continue;
    }

    if (recentSites.has(site.id)) {
      result.skippedCooldown++;
      continue;
    }

    const managed = managedDomains[0] || null;
    const needsRepair =
      !managed ||
      managed.verification_status !== "verified" ||
      managed.is_primary !== true;

    if (needsRepair) eligible.push(site);
  }

  result.eligible = eligible.length;

  for (const site of eligible.slice(0, MAX_REPAIRS)) {
    const repair = await runSupportRepair(service, {
      userId: site.owner_id,
      siteId: site.id,
      action: "managed_domain_repair",
      trigger: "system"
    });

    result.attempted++;
    if (repair.status === "succeeded") result.succeeded++;
    else if (repair.status === "no_change") result.noChange++;
    else result.failed++;
  }

  return result;
}

export async function runSupportRemediationSweepSafely(
  now = new Date()
): Promise<SupportRemediationSweepResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return {
      ...emptyResult(),
      ok: false,
      error: "support_remediation_sweep_not_configured"
    };
  }

  try {
    const service = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    return await sweepWithClient(service, now);
  } catch (error) {
    return {
      ...emptyResult(),
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "support_remediation_sweep_failed"
    };
  }
}
