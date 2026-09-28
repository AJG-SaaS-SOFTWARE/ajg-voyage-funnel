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

  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .eq("public_access_state", "live")
    .maybeSingle();

  if (error) throw error;
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
  const { data: domain, error: domainError } = await supabase.from("domains").select("site_id").eq("hostname", normalized).eq("verification_status", "verified").eq("is_primary", true).maybeSingle();
  if (domainError) throw domainError;
  if (!domain) return null;
  const { data, error } = await supabase.from("sites").select("*").eq("id", domain.site_id).eq("status", "published").eq("public_access_state", "live").maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, slug: data.slug, config: configFromRow(data), publishedAt: data.published_at, updatedAt: data.updated_at } : null;
}

export async function publicSiteUrl(siteId: string, slug: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (url && key) {
    const supabase = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: domain } = await supabase
      .from("domains")
      .select("hostname")
      .eq("site_id", siteId)
      .eq("verification_status", "verified")
      .eq("is_primary", true)
      .maybeSingle();

    if (domain?.hostname) {
      return `https://${domain.hostname}`;
    }
  }

  const base =
    process.env.NEXT_PUBLIC_SITE_BUILDER_URL ||
    "https://ajg-site-builder.vercel.app";
  return `${base.replace(/\/$/, "")}/site/${encodeURIComponent(slug)}`;
}
