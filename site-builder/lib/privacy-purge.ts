import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cancelStripeSubscription } from "./stripe-billing";

type PurgeResult = {
  systems: string[];
  sitesPurged: number;
};

function chunks<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function listStoragePaths(
  service: SupabaseClient,
  bucket: string,
  folder: string
): Promise<string[]> {
  const paths: string[] = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await service.storage
      .from(bucket)
      .list(folder, {
        limit: pageSize,
        offset,
        sortBy: { column: "name", order: "asc" }
      });

    if (error) {
      if (/not found|bucket/i.test(error.message || "")) return paths;
      throw error;
    }

    const page = data || [];
    for (const item of page) {
      const path = folder + "/" + item.name;
      if (item.id) {
        paths.push(path);
      } else {
        paths.push(...await listStoragePaths(service, bucket, path));
      }
    }

    if (page.length < pageSize) break;
  }

  return paths;
}

async function removeStoragePrefix(
  service: SupabaseClient,
  bucket: string,
  prefix: string
) {
  const paths = await listStoragePaths(service, bucket, prefix);
  for (const batch of chunks(paths, 1000)) {
    const { error } = await service.storage.from(bucket).remove(batch);
    if (error) throw error;
  }
  return paths.length;
}

async function detachVercelDomain(hostname: string) {
  const token = process.env.VERCEL_TOKEN?.trim() || "";
  const project =
    process.env.VERCEL_PROJECT_ID?.trim() ||
    "prj_RUtVL1fXzOqY8dHetb6U2dp07Ygn";
  const team =
    process.env.VERCEL_TEAM_ID?.trim() ||
    "team_T1xBMzY6HJCAkUStrmkUgj60";

  if (!token) throw new Error("vercel_not_configured");

  const response = await fetch(
    `https://api.vercel.com/v9/projects/${encodeURIComponent(project)}/domains/${encodeURIComponent(hostname)}?teamId=${encodeURIComponent(team)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      cache: "no-store"
    }
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(`vercel_domain_delete_${response.status}`);
  }
}

async function cancelSiteSubscription(
  service: SupabaseClient,
  siteId: string
) {
  const { data: subscription, error } = await service
    .from("site_subscriptions")
    .select("provider,provider_subscription_id,status")
    .eq("site_id", siteId)
    .maybeSingle();

  if (error) throw error;
  if (
    subscription?.provider !== "stripe" ||
    !subscription.provider_subscription_id ||
    subscription.status === "canceled"
  ) {
    return false;
  }

  try {
    await cancelStripeSubscription(subscription.provider_subscription_id);
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "resource_missing") {
      throw error;
    }
  }

  const { error: updateError } = await service
    .from("site_subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("site_id", siteId);
  if (updateError) throw updateError;
  return true;
}

export async function purgeBuilderSite(
  service: SupabaseClient,
  siteId: string,
  ownerId: string
): Promise<PurgeResult> {
  const { data: site, error: siteError } = await service
    .from("sites")
    .select("id,owner_id,slug")
    .eq("id", siteId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (siteError) throw siteError;
  if (!site) {
    return { systems: ["site_already_absent"], sitesPurged: 0 };
  }

  const systems: string[] = [];

  if (await cancelSiteSubscription(service, site.id)) {
    systems.push("stripe_subscription_canceled");
    systems.push("stripe_financial_records_retained");
  }

  const { data: domains, error: domainError } = await service
    .from("domains")
    .select("id,hostname")
    .eq("site_id", site.id);
  if (domainError) throw domainError;

  for (const domain of domains || []) {
    await detachVercelDomain(domain.hostname);
  }
  if ((domains || []).length) systems.push("vercel_domains_detached");

  const prefix = ownerId + "/" + site.id;
  const publicRemoved = await removeStoragePrefix(
    service,
    "site-media",
    prefix
  );
  const privateRemoved = await removeStoragePrefix(
    service,
    "site-private-media",
    prefix
  );
  systems.push(`storage_public:${publicRemoved}`);
  systems.push(`storage_private:${privateRemoved}`);

  // These tables use ON DELETE SET NULL for site_id. Remove their site-scoped
  // records before deleting the site so content/usage traces are not orphaned.
  for (const table of ["ai_provider_usage", "ai_usage_events", "user_feedback"]) {
    const { error } = await service.from(table).delete().eq("site_id", site.id);
    if (error) throw error;
  }
  systems.push("site_scoped_usage_removed");

  const { error: deleteError } = await service
    .from("sites")
    .delete()
    .eq("id", site.id)
    .eq("owner_id", ownerId);
  if (deleteError) throw deleteError;

  systems.push("site_database_cascade_completed");
  return { systems, sitesPurged: 1 };
}

export async function purgeBuilderAccount(
  service: SupabaseClient,
  ownerId: string
): Promise<PurgeResult> {
  const { data: sites, error } = await service
    .from("sites")
    .select("id")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const systems: string[] = [];
  let sitesPurged = 0;

  for (const site of sites || []) {
    const result = await purgeBuilderSite(service, site.id, ownerId);
    systems.push(...result.systems);
    sitesPurged += result.sitesPurged;
  }

  // Ban first so no new authentication can be established while deletion is
  // finalized. Supabase deletes refresh sessions with the user; any already
  // issued access token can live until exp, but all owned rows are gone and
  // owner FKs prevent creation for a non-existent auth user.
  const { error: banError } = await service.auth.admin.updateUserById(ownerId, {
    ban_duration: "876000h"
  });
  if (banError && !/not found/i.test(banError.message || "")) throw banError;

  const { error: deleteUserError } = await service.auth.admin.deleteUser(ownerId);
  if (deleteUserError && !/not found/i.test(deleteUserError.message || "")) {
    throw deleteUserError;
  }

  systems.push("supabase_auth_deleted");
  return { systems, sitesPurged };
}
