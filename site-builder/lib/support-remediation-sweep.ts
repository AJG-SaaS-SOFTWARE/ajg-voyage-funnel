import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSupportRepair } from "./support-remediation";
import { supportScanWindow } from "./support-scan-window";
import { createSupportHealthDiagnoser } from "./support-health-server";
import { resolveVerifiedSupportRepair, type RepairTicketSnapshot } from "./support-repair-resolution";
import { completeVerifiedSupportRepairInRun } from "./run-intake-reporting";

const MAX_SCAN = 50;
const MAX_REPAIRS = 10;
// Central confirmation can take up to 25s. Bound this added work for the
// existing 180s cron budget; rotating windows prevent a fixed-site bias.
const MAX_LINKED_REPAIRS = 2;
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
  ticketsResolved: number;
  centralResolutionsVerified: number;
  ticketCompletionFailures: number;
  skippedTicketBudget: number;
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
    skippedAmbiguous: 0,
    ticketsResolved: 0,
    centralResolutionsVerified: 0,
    ticketCompletionFailures: 0,
    skippedTicketBudget: 0
  };
}

async function sweepWithClient(
  service: SupabaseClient,
  now: Date
): Promise<SupportRemediationSweepResult> {
  const result = emptyResult();

  const { count, error: countError } = await service.from("sites")
    .select("id", { count: "exact", head: true })
    .eq("status", "published").eq("privacy_state", "active");
  if (countError) throw new Error("remediation_site_count_unavailable");
  const window = supportScanWindow(count, now, MAX_SCAN);
  if (!window.count) return result;

  const { data: siteRows, error: siteError } = await service
    .from("sites")
    .select("id,owner_id")
    .eq("status", "published")
    .eq("privacy_state", "active")
    .order("id", { ascending: true })
    .limit(MAX_SCAN)
    .range(window.offset, window.end);

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

  // Rotate before eligibility/cooldown filtering, otherwise permanent failures
  // at the front can repeatedly consume every available repair slot.
  const repairStart = (window.cycle * MAX_REPAIRS) % sites.length;
  const repairOrder = [...sites.slice(repairStart), ...sites.slice(0, repairStart)];
  for (const site of repairOrder) {
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
  let diagnose: ReturnType<typeof createSupportHealthDiagnoser> | undefined;
  let linkedRepairs = 0;

  for (const site of eligible.slice(0, MAX_REPAIRS)) {
    let stage: "selection" | "repair" | "completion" = "selection";
    try {
      // Bind the audit before the mutation. An unavailable or ambiguous lookup
      // must not consume the repair while leaving its source ticket unprovable.
      const { data: tickets, error: ticketError } = await service.from("support_tickets")
        .select("id,user_id,site_id,status,category,updated_at,diagnosis")
        .eq("user_id", site.owner_id).eq("site_id", site.id).eq("category", "domain")
        .in("status", ["diagnosed", "waiting_customer"]).limit(2);
      if (ticketError || !Array.isArray(tickets) || tickets.length > 1 ||
          (tickets.length === 1 && (!tickets[0] || typeof tickets[0] !== "object" || Array.isArray(tickets[0])))) {
        result.ticketCompletionFailures++;
        result.error = "support_repair_ticket_selection_unconfirmed";
        continue;
      }
      const ticket = (tickets[0] || null) as RepairTicketSnapshot | null;
      if (ticket && (typeof ticket.id !== "string" || !ticket.id ||
          ticket.user_id !== site.owner_id || ticket.site_id !== site.id ||
          ticket.category !== "domain" || !["diagnosed", "waiting_customer"].includes(ticket.status) ||
          typeof ticket.updated_at !== "string" || !Number.isFinite(Date.parse(ticket.updated_at)))) {
        result.ticketCompletionFailures++;
        result.error = "support_repair_ticket_selection_unconfirmed";
        continue;
      }

      if (ticket && linkedRepairs >= MAX_LINKED_REPAIRS) {
        result.skippedTicketBudget++;
        continue;
      }
      if (ticket) linkedRepairs++;

      result.attempted++;
      stage = "repair";
      const repair = await runSupportRepair(service, {
        userId: site.owner_id,
        siteId: site.id,
        action: "managed_domain_repair",
        trigger: "system",
        ticketId: ticket?.id || null
      });

      if (repair.status === "succeeded" && repair.verified === true && repair.audited === true) result.succeeded++;
      else if (repair.status === "succeeded") result.failed++;
      else if (repair.status === "no_change") result.noChange++;
      else result.failed++;
      stage = "completion";

      if (ticket && repair.status === "succeeded" && repair.verified === true && repair.audited === true) {
        // The existing resolver checks recovery, the exact audit and ticket CAS;
        // the central receiver independently rechecks those durable proofs.
        diagnose ||= createSupportHealthDiagnoser(service);
        const health = await diagnose(site.owner_id, site.id);
        const resolution = await resolveVerifiedSupportRepair(service, {
          ticket, userId: site.owner_id, siteId: site.id, repair, health,
        });
        if (!resolution.resolved || !resolution.audited) {
          result.ticketCompletionFailures++;
          result.error = "support_repair_ticket_resolution_unconfirmed";
          continue;
        }
        result.ticketsResolved++;
        if (await completeVerifiedSupportRepairInRun(service, ticket.id)) {
          result.centralResolutionsVerified++;
        } else {
          result.ticketCompletionFailures++;
          result.error = "support_repair_central_resolution_unconfirmed";
        }
      }
    } catch {
      // A rejected query can escape before the repair's own provider handler.
      // Preserve completed work and let independent sites finish; never retry
      // this site's potentially partial mutation within the same sweep.
      if (stage === "repair") result.failed++;
      else result.ticketCompletionFailures++;
      result.error = stage === "repair" ? "support_repair_execution_failed"
        : stage === "selection" ? "support_repair_ticket_selection_unconfirmed"
        : "support_repair_ticket_resolution_unconfirmed";
    }
  }

  result.ok = result.failed === 0 && result.ticketCompletionFailures === 0;
  return result;
}

export async function runSupportRemediationSweepSafely(
  now = new Date(),
  serviceOverride?: SupabaseClient
): Promise<SupportRemediationSweepResult> {
  if (serviceOverride) {
    try {
      return await sweepWithClient(serviceOverride, now);
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
