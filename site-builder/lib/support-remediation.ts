import type { SupabaseClient } from "@supabase/supabase-js";
import {
  syncVercelDomain,
  VercelDomainSyncError
} from "./vercel-domain-sync";
import { managedHostname, managedSlugFromHostname } from "./published-domain";

export type SupportRepairAction = "managed_domain_repair";
export type SupportRepairTrigger = "client" | "system" | "admin";
export type SupportRepairStatus = "succeeded" | "no_change" | "failed";

export type SupportRepairResult = {
  action: SupportRepairAction;
  status: SupportRepairStatus;
  code: string;
  siteId: string;
  changed: boolean;
  verified?: boolean;
  audited?: boolean;
};

function expectedManagedHostname(slug: string) {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(normalizedSlug)) {
    return null;
  }
  return managedHostname(normalizedSlug);
}

function boundedMetadata(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, item]) =>
        /^[a-z0-9_]{1,40}$/i.test(key) &&
        (item === null ||
          typeof item === "string" ||
          typeof item === "number" ||
          typeof item === "boolean")
      )
      .slice(0, 12)
  );
}

async function auditRepair(
  service: SupabaseClient,
  input: {
    userId: string;
    siteId: string;
    ticketId?: string | null;
    action: SupportRepairAction;
    trigger: SupportRepairTrigger;
    status: SupportRepairStatus;
    code: string;
    metadata?: Record<string, unknown>;
  }
) {
  const { error } = await service.from("support_remediation_runs").insert({
    user_id: input.userId,
    site_id: input.siteId,
    ticket_id: input.ticketId || null,
    action: input.action,
    trigger_source: input.trigger,
    status: input.status,
    result_code: input.code.slice(0, 120),
    metadata: boundedMetadata(input.metadata || {})
  });

  if (error) {
    console.error("Support remediation audit failed", {
      action: input.action,
      siteId: input.siteId,
      code: error.code || "unknown"
    });
    return false;
  }
  return true;
}

async function finish(
  service: SupabaseClient,
  input: {
    userId: string;
    siteId: string;
    ticketId?: string | null;
    action: SupportRepairAction;
    trigger: SupportRepairTrigger;
    status: SupportRepairStatus;
    code: string;
    changed: boolean;
    verified?: boolean;
    metadata?: Record<string, unknown>;
  }
): Promise<SupportRepairResult> {
  const audited = await auditRepair(service, input);
  return {
    action: input.action,
    status: input.status,
    code: input.code,
    siteId: input.siteId,
    changed: input.changed,
    verified: input.verified,
    audited
  };
}

async function repairManagedDomain(
  service: SupabaseClient,
  input: {
    userId: string;
    siteId: string;
    ticketId?: string | null;
    trigger: SupportRepairTrigger;
  }
): Promise<SupportRepairResult> {
  const action: SupportRepairAction = "managed_domain_repair";
  const { data: site, error: siteError } = await service
    .from("sites")
    .select("id,owner_id,slug,status,privacy_state")
    .eq("id", input.siteId)
    .eq("owner_id", input.userId)
    .maybeSingle();

  if (siteError || !site) {
    return {
      action,
      status: "failed",
      code: "site_not_owned",
      siteId: input.siteId,
      changed: false,
      audited: false
    };
  }

  if (site.privacy_state !== "active") {
    return finish(service, {
      ...input,
      action,
      status: "no_change",
      code: "privacy_state_blocks_repair",
      changed: false
    });
  }

  if (site.status !== "published") {
    return finish(service, {
      ...input,
      action,
      status: "no_change",
      code: "site_not_published",
      changed: false
    });
  }

  const expectedHostname = expectedManagedHostname(site.slug);
  if (!expectedHostname) {
    return finish(service, {
      ...input,
      action,
      status: "failed",
      code: "invalid_managed_hostname",
      changed: false
    });
  }

  const { data: domains, error: domainsError } = await service
    .from("domains")
    .select("id,hostname,kind,verification_status,is_primary")
    .eq("site_id", site.id);

  if (domainsError) {
    return finish(service, {
      ...input,
      action,
      status: "failed",
      code: "domain_state_unavailable",
      changed: false
    });
  }

  const customDomain = (domains || []).find(
    (domain) => domain.kind === "custom_domain"
  );
  if (customDomain) {
    return finish(service, {
      ...input,
      action,
      status: "no_change",
      code: "custom_domain_configured",
      changed: false
    });
  }

  let managed = (domains || []).find((domain) => domain.kind === "managed_subdomain") || null;
  let created = false;

  if (!managed) {
    const { data: inserted, error: insertError } = await service
      .from("domains")
      .insert({
        site_id: site.id,
        hostname: expectedHostname,
        kind: "managed_subdomain",
        verification_status: "pending",
        is_primary: false
      })
      .select("id,hostname,kind,verification_status,is_primary")
      .single();

    if (insertError || !inserted) {
      return finish(service, {
        ...input,
        action,
        status: "failed",
        code: insertError?.code === "23505"
          ? "managed_domain_conflict"
          : "managed_domain_create_failed",
        changed: false
      });
    }
    managed = inserted;
    created = true;
  }

  const managedSlug = managedSlugFromHostname(managed.hostname);
  if (managed.hostname !== expectedHostname && managedSlug !== site.slug) {
    return finish(service, {
      ...input,
      action,
      status: "failed",
      code: "managed_domain_hostname_mismatch",
      changed: created,
      metadata: { expected_hostname: expectedHostname }
    });
  }

  const hostnameToSync = managed.hostname;

  const verifiedCustomInSnapshot = (domains || []).find(
    (domain) =>
      domain.kind === "custom_domain" &&
      domain.verification_status === "verified"
  );

  if (managed.verification_status === "verified") {
    if (verifiedCustomInSnapshot) {
      return finish(service, {
        ...input,
        action,
        status: "no_change",
        code: "verified_custom_domain_is_primary_candidate",
        changed: false,
        verified: true
      });
    }
    if (managed.is_primary) {
      return finish(service, {
        ...input,
        action,
        status: "no_change",
        code: "managed_domain_already_healthy",
        changed: false,
        verified: true
      });
    }

    const { error: clearPrimaryError } = await service
      .from("domains")
      .update({ is_primary: false })
      .eq("site_id", site.id);
    if (clearPrimaryError) {
      return finish(service, {
        ...input,
        action,
        status: "failed",
        code: "primary_domain_reset_failed",
        changed: false,
        verified: true
      });
    }

    const { error: promoteError } = await service
      .from("domains")
      .update({ is_primary: true })
      .eq("id", managed.id);
    if (promoteError) {
      return finish(service, {
        ...input,
        action,
        status: "failed",
        code: "managed_domain_primary_repair_failed",
        changed: false,
        verified: true
      });
    }

    return finish(service, {
      ...input,
      action,
      status: "succeeded",
      code: "managed_domain_primary_repaired",
      changed: true,
      verified: true
    });
  }

  try {
    const sync = await syncVercelDomain(hostnameToSync, "managed_subdomain");
    if (!sync.verified) {
      await service
        .from("domains")
        .update({ verification_status: "pending", is_primary: false })
        .eq("id", managed.id);

      return finish(service, {
        ...input,
        action,
        status: "failed",
        code: "managed_domain_still_pending",
        changed: created,
        verified: false,
        metadata: {
          ownership_verified: sync.ownershipVerified,
          misconfigured: sync.misconfigured
        }
      });
    }

    const { data: verifiedCustom, error: customError } = await service
      .from("domains")
      .select("id")
      .eq("site_id", site.id)
      .eq("kind", "custom_domain")
      .eq("verification_status", "verified")
      .limit(1)
      .maybeSingle();

    if (customError) {
      return finish(service, {
        ...input,
        action,
        status: "failed",
        code: "custom_domain_state_unavailable",
        changed: created,
        verified: true
      });
    }

    if (!verifiedCustom) {
      const { error: clearPrimaryError } = await service
        .from("domains")
        .update({ is_primary: false })
        .eq("site_id", site.id);
      if (clearPrimaryError) {
        return finish(service, {
          ...input,
          action,
          status: "failed",
          code: "primary_domain_reset_failed",
          changed: created,
          verified: true
        });
      }
    }

    const { error: updateError } = await service
      .from("domains")
      .update({
        verification_status: "verified",
        is_primary: !verifiedCustom
      })
      .eq("id", managed.id);

    if (updateError) {
      return finish(service, {
        ...input,
        action,
        status: "failed",
        code: "managed_domain_state_update_failed",
        changed: created,
        verified: true
      });
    }

    return finish(service, {
      ...input,
      action,
      status: "succeeded",
      code: created
        ? "managed_domain_created_and_verified"
        : "managed_domain_verified",
      changed: true,
      verified: true
    });
  } catch (error) {
    const code =
      error instanceof VercelDomainSyncError
        ? error.code
        : "managed_domain_sync_failed";
    return finish(service, {
      ...input,
      action,
      status: "failed",
      code,
      changed: created
    });
  }
}

export async function runSupportRepair(
  service: SupabaseClient,
  input: {
    userId: string;
    siteId: string;
    action: SupportRepairAction;
    trigger: SupportRepairTrigger;
    ticketId?: string | null;
  }
): Promise<SupportRepairResult> {
  if (input.action === "managed_domain_repair") {
    return repairManagedDomain(service, input);
  }

  return finish(service, {
    ...input,
    status: "failed",
    code: "unsupported_repair_action",
    changed: false
  });
}
