import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { normalizeContentLibrary, normalizeSiteArchitecture, type SiteConfig, type SiteLanguage } from "./site-config";
import { normalizeSiteDesign } from "./site-design";
import { normalizeSiteLegalConfig } from "./site-legal";

export type PublicSiteRecord = {
  id: string;
  slug: string;
  config: SiteConfig;
  publishedAt: string | null;
  updatedAt: string;
};

const PUBLIC_READ_RETRY_DELAYS_MS = [0, 160, 480] as const;

function transientPublicReadError(error: unknown) {
  const value = error && typeof error === "object"
    ? [
        "message" in error ? String((error as { message?: unknown }).message ?? "") : "",
        "details" in error ? String((error as { details?: unknown }).details ?? "") : "",
        "hint" in error ? String((error as { hint?: unknown }).hint ?? "") : "",
        "code" in error ? String((error as { code?: unknown }).code ?? "") : ""
      ].join(" ")
    : String(error ?? "");

  return /(fetch failed|network|enotfound|econnreset|etimedout|timeout|web server is down|bad gateway|service unavailable|gateway timeout|\b52[0-4]\b|\b50[234]\b)/i.test(value);
}

async function publicReadWithRetry(
  read: () => PromiseLike<{ data: any; error: any }>
) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < PUBLIC_READ_RETRY_DELAYS_MS.length; attempt += 1) {
    const delay = PUBLIC_READ_RETRY_DELAYS_MS[attempt];
    if (delay) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    try {
      const result = await read();
      if (!result.error) return result.data;
      lastError = result.error;
    } catch (error) {
      lastError = error;
    }

    const finalAttempt = attempt === PUBLIC_READ_RETRY_DELAYS_MS.length - 1;
    if (finalAttempt || !transientPublicReadError(lastError)) {
      throw lastError;
    }
  }

  throw lastError || new Error("public_site_read_failed");
}

function configFromRow(row: any): SiteConfig {
  const enabled = Array.isArray(row.enabled_languages) ? row.enabled_languages : [row.primary_language];
  const language: SiteLanguage =
    enabled.includes("fr") && enabled.includes("en")
      ? "both"
      : row.primary_language === "en"
        ? "en"
        : "fr";

  return {
    slug: row.slug,
    firstName: row.first_name,
    lastName: row.last_name,
    brandName: row.brand_name,
    language,
    heroTitle: row.hero_title,
    heroSubtitle: row.hero_subtitle,
    heroTagline: row.hero_tagline || "",
    aboutText: row.about_text,
    aboutHeading: row.about_heading || "",
    bookingLabel: row.booking_label,
    bookingUrl: row.booking_url,
    profileImageUrl: row.profile_image_url,
    showTravelJournals: row.show_travel_journals,
    instagramUrl: row.instagram_url,
    facebookUrl: row.facebook_url,
    design: normalizeSiteDesign(row.design_assets),
    affiliation: row.compliance_profile === "independent-v1" ? "independent" : "mwr",
    legal: normalizeSiteLegalConfig(row.legal_config),
    architecture: normalizeSiteArchitecture(row.design_assets?.architecture),
    contentLibrary: normalizeContentLibrary(row.design_assets?.contentLibrary)
  };
}

export async function getPublicSite(slug: string): Promise<PublicSiteRecord | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const data = await publicReadWithRetry(() =>
    supabase
      .from("sites")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .eq("public_access_state", "live")
      .maybeSingle()
  );

  if (!data) return null;

  return {
    id: data.id,
    slug: data.slug,
    config: configFromRow(data),
    publishedAt: data.published_at,
    updatedAt: data.updated_at
  };
}

export async function getPublicSiteByHostname(hostname: string): Promise<PublicSiteRecord | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const supabase = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const normalized = hostname.trim().toLowerCase().replace(/:\d+$/, "");

  const domain = await publicReadWithRetry(() =>
    supabase
      .from("domains")
      .select("site_id")
      .eq("hostname", normalized)
      .eq("verification_status", "verified")
      .eq("is_primary", true)
      .maybeSingle()
  );
  if (!domain) return null;

  const data = await publicReadWithRetry(() =>
    supabase
      .from("sites")
      .select("*")
      .eq("id", domain.site_id)
      .eq("status", "published")
      .eq("public_access_state", "live")
      .maybeSingle()
  );

  return data ? { id: data.id, slug: data.slug, config: configFromRow(data), publishedAt: data.published_at, updatedAt: data.updated_at } : null;
}

export async function publicSiteUrl(siteId: string, slug: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (url && key) {
    const supabase = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    try {
      const data = await publicReadWithRetry(() =>
        supabase
          .from("domains")
          .select("hostname")
          .eq("site_id", siteId)
          .eq("verification_status", "verified")
          .eq("is_primary", true)
          .maybeSingle()
      );

      if (data?.hostname) {
        return `https://${data.hostname}`;
      }
    } catch {
      // Canonical resolution must never take a public site down.
    }
  }

  const base =
    process.env.NEXT_PUBLIC_SITE_BUILDER_URL ||
    "https://eltara.ajgsolutionsgroup.com";
  return `${base.replace(/\/$/, "")}/site/${encodeURIComponent(slug)}`;
}
