import type { SupabaseClient } from "@supabase/supabase-js";
import { appBaseUrl } from "./app-url";
import { getStorageBackupStatus } from "./storage-backup";
import { getAiQuotaHealth } from "./ai-quota-health";
import {
  buildSupportDiagnosis,
  type SupportDiagnosis
} from "./support-diagnostics";

async function publicSiteProbe(slug: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  const startedAt = Date.now();
  try {
    const response = await fetch(
      `${appBaseUrl()}/site/${encodeURIComponent(slug)}`,
      {
        method: "GET",
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": "AJG-Site-Builder-Health/1.0" }
      }
    );
    const durationMs = Date.now() - startedAt;
    const html = response.ok ? (await response.text()).slice(0, 150000) : "";
    const canonicalTag =
      html.match(/<link[^>]*rel=["']canonical["'][^>]*>/i)?.[0]
      || html.match(/<link[^>]*href=["'][^"']+["'][^>]*rel=["']canonical["'][^>]*>/i)?.[0]
      || "";
    return {
      checked: true,
      ok: response.ok,
      status: response.status,
      durationMs,
      canonicalPresent: Boolean(canonicalTag),
      canonicalHttps: /href=["']https:\/\//i.test(canonicalTag)
    };
  } catch {
    return {
      checked: true,
      ok: false,
      status: null,
      durationMs: Date.now() - startedAt,
      canonicalPresent: false,
      canonicalHttps: false
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function sitemapProbe(slug: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(
      `${appBaseUrl()}/site/${encodeURIComponent(slug)}/sitemap.xml`,
      {
        method: "GET",
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": "AJG-Site-Builder-Health/1.0" }
      }
    );
    const body = response.ok ? (await response.text()).slice(0, 150000) : "";
    const contentType = response.headers.get("content-type") || "";
    return {
      checked: true,
      ok: response.ok,
      status: response.status,
      validXml:
        /xml/i.test(contentType)
        && /<urlset\b/i.test(body)
        && /<loc>https?:\/\//i.test(body)
    };
  } catch {
    return { checked: true, ok: false, status: null, validXml: false };
  } finally {
    clearTimeout(timeout);
  }
}


function httpsUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function contentHealthFromConfig(value: unknown) {
  const config =
    value && typeof value === "object"
      ? (value as Record<string, any>)
      : {};
  const design =
    config.design && typeof config.design === "object"
      ? config.design
      : {};
  const modules =
    design.modules && typeof design.modules === "object"
      ? design.modules
      : {};
  const contact =
    modules.contact && typeof modules.contact === "object"
      ? modules.contact
      : {};
  const gallery =
    modules.gallery && typeof modules.gallery === "object"
      ? modules.gallery
      : {};
  const video =
    modules.video && typeof modules.video === "object"
      ? modules.video
      : {};

  const configuredLinks: unknown[] = [
    config.bookingUrl,
    config.instagramUrl,
    config.facebookUrl,
    video.enabled === true ? video.url : ""
  ];
  const nonEmptyLinks = configuredLinks.filter(
    (item) => typeof item === "string" && item.trim()
  );
  const invalidConfiguredLinks = nonEmptyLinks.filter(
    (item) => !httpsUrl(item)
  ).length;

  const galleryImages = Array.isArray(gallery.images)
    ? gallery.images.filter(
        (item: any) => httpsUrl(item?.url)
      )
    : [];

  const assets = Array.isArray(config.contentLibrary?.assets)
    ? config.contentLibrary.assets
    : [];
  const missingPublishableMedia = assets.filter((asset: any) => {
    if (asset?.publishable !== true || asset?.kind === "text") return false;
    return !httpsUrl(asset?.url);
  }).length;

  const contactEmail =
    typeof contact.email === "string" ? contact.email.trim() : "";

  return {
    contactEnabled: contact.enabled === true,
    contactEmailValid:
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail),
    galleryEnabled: gallery.enabled === true,
    galleryImageCount: galleryImages.length,
    invalidConfiguredLinks,
    checkedConfiguredLinks: nonEmptyLinks.length,
    missingPublishableMedia
  };
}

async function safeStorageAvailability(service: SupabaseClient) {
  try {
    const [publicBucket, privateBucket] = await Promise.all([
      service.storage.getBucket("site-media"),
      service.storage.getBucket("site-private-media")
    ]);
    return {
      publicBucketAvailable: Boolean(publicBucket.data) && !publicBucket.error,
      privateBucketAvailable: Boolean(privateBucket.data) && !privateBucket.error
    };
  } catch {
    return {
      publicBucketAvailable: false,
      privateBucketAvailable: false
    };
  }
}

async function safeBackupStatus() {
  try {
    return await getStorageBackupStatus();
  } catch {
    return {
      configured: false,
      status: "unknown" as const,
      ageHours: null
    };
  }
}

export async function diagnoseSupportHealth(
  service: SupabaseClient,
  userId: string,
  preferredSiteId?: string | null
): Promise<{ siteId: string | null; diagnosis: SupportDiagnosis }> {
  let siteQuery = service
    .from("sites")
    .select("id,slug,status,public_access_state,owner_id,created_at,config")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (preferredSiteId) {
    siteQuery = service
      .from("sites")
      .select("id,slug,status,public_access_state,owner_id,created_at,config")
      .eq("owner_id", userId)
      .eq("id", preferredSiteId)
      .limit(1);
  }

  const { data: siteRows, error: siteError } = await siteQuery;
  if (siteError) {
    return {
      siteId: null,
      diagnosis: buildSupportDiagnosis({
        backendOk: false,
        site: null,
        domains: [],
        billingState: null
      })
    };
  }

  const site = siteRows?.[0] || null;
  if (!site) {
    return {
      siteId: null,
      diagnosis: buildSupportDiagnosis({
        backendOk: true,
        site: null,
        domains: [],
        billingState: null
      })
    };
  }

  const [
    { data: domains, error: domainError },
    { data: billing, error: billingError },
    { data: aiPolicy, error: aiPolicyError },
    backup,
    storage,
    publicRender,
    sitemap,
    aiQuota
  ] = await Promise.all([
    service
      .from("domains")
      .select("hostname,kind,verification_status,is_primary")
      .eq("site_id", site.id),
    service
      .from("site_billing_states")
      .select("state")
      .eq("site_id", site.id)
      .maybeSingle(),
    service
      .from("ai_cost_policy")
      .select("ai_enabled,heavy_enabled")
      .eq("singleton", true)
      .maybeSingle(),
    safeBackupStatus(),
    safeStorageAvailability(service),
    site.status === "published" && site.public_access_state !== "suspended"
      ? publicSiteProbe(site.slug)
      : Promise.resolve({ checked: false, ok: false, status: null }),
    site.status === "published" && site.public_access_state !== "suspended"
      ? sitemapProbe(site.slug)
      : Promise.resolve({ checked: false, ok: false, status: null, validXml: false }),
    getAiQuotaHealth(service, userId, site.id).catch(() => ({
      planKey: "unknown",
      planName: "Indisponible",
      status: "unavailable" as const,
      minute: { used: 0, limit: 0 },
      daily: { used: 0, limit: 0 },
      monthly: { used: 0, limit: 0 }
    }))
  ]);

  return {
    siteId: site.id,
    diagnosis: buildSupportDiagnosis({
      backendOk: !domainError && !billingError,
      site: {
        id: site.id,
        slug: site.slug,
        status: site.status,
        publicAccessState: site.public_access_state
      },
      domains: (domains || []).map((domain) => ({
        hostname: domain.hostname,
        kind: domain.kind,
        verificationStatus: domain.verification_status,
        isPrimary: domain.is_primary
      })),
      billingState: billing?.state || null,
      content: contentHealthFromConfig(site.config),
      storage,
      publicRender,
      sitemap,
      backup: {
        configured: backup.configured,
        status: backup.status,
        ageHours: backup.ageHours
      },
      ai:
        !aiPolicyError && aiPolicy
          ? {
              enabled: aiPolicy.ai_enabled === true,
              heavyEnabled: aiPolicy.heavy_enabled === true,
              quota: aiQuota
            }
          : undefined
    })
  };
}
