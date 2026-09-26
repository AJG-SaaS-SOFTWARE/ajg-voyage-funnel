import type { User } from "@supabase/supabase-js";
import { defaultSiteConfig, type SiteConfig, type SiteLanguage } from "./site-config";
import { getSupabaseBrowserClient } from "./supabase-browser";
import { normalizeSiteDesign } from "./site-design";

export type RemoteSite = {
  id: string;
  ownerId: string;
  slug: string;
  status: "draft" | "published" | "suspended";
  config: SiteConfig;
  publishedAt: string | null;
  updatedAt: string;
};

function languageFields(language: SiteLanguage) {
  if (language === "both") {
    return { primary_language: "fr", enabled_languages: ["fr", "en"] };
  }
  return { primary_language: language, enabled_languages: [language] };
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
    affiliation: row.compliance_profile === "independent-v1" ? "independent" : "mwr"
  };
}

function draftFromRow(row: any, draft: any): SiteConfig {
  const published = configFromRow(row);
  if (!draft || typeof draft !== "object") return published;
  return { ...defaultSiteConfig, ...published, ...draft, design: normalizeSiteDesign(draft.design ?? published.design) };
}

function payload(user: User, config: SiteConfig, status: "draft" | "published") {
  const language = languageFields(config.language);
  return {
    owner_id: user.id,
    slug: config.slug,
    status,
    ...language,
    brand_name: config.brandName,
    first_name: config.firstName,
    last_name: config.lastName,
    hero_title: config.heroTitle,
    hero_subtitle: config.heroSubtitle,
    hero_tagline: config.heroTagline,
    about_text: config.aboutText,
    about_heading: config.aboutHeading,
    booking_label: config.bookingLabel,
    booking_url: config.bookingUrl,
    instagram_url: config.instagramUrl,
    facebook_url: config.facebookUrl,
    design_assets: config.design,
    profile_image_url: config.profileImageUrl,
    show_travel_journals: config.showTravelJournals,
    compliance_profile: config.affiliation === "independent" ? "independent-v1" : "mwr-life-independent-ambassador-v1",
    published_at: status === "published" ? new Date().toISOString() : null
  };
}

function toRemote(row: any, draft?: any): RemoteSite {
  return {
    id: row.id,
    ownerId: row.owner_id,
    slug: row.slug,
    status: row.status,
    config: draftFromRow(row, draft),
    publishedAt: row.published_at,
    updatedAt: row.updated_at
  };
}

async function ensureManagedDomain(siteId: string, slug: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase n'est pas configuré.");

  const root =
    process.env.NEXT_PUBLIC_PUBLISHED_ROOT_DOMAIN ||
    "voyage.ajgsolutionsgroup.com";
  const hostname = `${slug}.${root}`;

  const { data: existing, error: readError } = await supabase
    .from("domains")
    .select("id")
    .eq("site_id", siteId)
    .eq("kind", "managed_subdomain")
    .maybeSingle();

  if (readError) throw readError;

  if (existing) {
    const { error } = await supabase
      .from("domains")
      .update({
        hostname,
        verification_status: "verified",
        is_primary: true
      })
      .eq("id", existing.id);

    if (error) throw error;
    return hostname;
  }

  const { error } = await supabase.from("domains").insert({
    site_id: siteId,
    hostname,
    kind: "managed_subdomain",
    verification_status: "verified",
    is_primary: true
  });

  if (error) throw error;
  return hostname;
}

export async function getCurrentUser() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function getMySite(): Promise<RemoteSite | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const { data: draft, error: draftError } = await supabase.from("site_drafts").select("config").eq("site_id", data.id).maybeSingle();
  if (draftError) throw draftError;
  return toRemote(data, draft?.config);
}

export async function saveMySite(config: SiteConfig, publish = false): Promise<RemoteSite> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase n'est pas configuré.");

  const user = await getCurrentUser();
  if (!user) throw new Error("Vous devez être connecté.");

  const existing = await getMySite();
  const nextPayload = payload(user, config, publish ? "published" : "draft");

  if (existing) {
    if (!publish && existing.status === "published") {
      const { error } = await supabase.from("site_drafts").upsert({ site_id: existing.id, owner_id: user.id, config }, { onConflict: "site_id" });
      if (error) throw error;
      return { ...existing, config };
    }
    const { data, error } = await supabase
      .from("sites")
      .update(nextPayload)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) throw error;
    const remote = toRemote(data);
    if (publish) {
      await ensureManagedDomain(remote.id, remote.slug);
      const { error: draftError } = await supabase.from("site_drafts").delete().eq("site_id", remote.id);
      if (draftError) throw draftError;
    }
    return remote;
  }

  const { data, error } = await supabase
    .from("sites")
    .insert(nextPayload)
    .select("*")
    .single();

  if (error) throw error;
  const remote = toRemote(data);
  if (publish) await ensureManagedDomain(remote.id, remote.slug);
  return remote;
}

export async function getPublishedSite(slug: string): Promise<RemoteSite | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) throw error;
  return data ? toRemote(data) : null;
}

export async function uploadProfileImage(file: File, siteId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase n'est pas configuré.");

  const user = await getCurrentUser();
  if (!user) throw new Error("Vous devez être connecté.");

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const objectPath = `${user.id}/${siteId}/profile/profile.${extension}`;

  const { error } = await supabase.storage
    .from("site-media")
    .upload(objectPath, file, {
      upsert: true,
      contentType: file.type || undefined
    });

  if (error) throw error;

  const { data } = supabase.storage.from("site-media").getPublicUrl(objectPath);
  return data.publicUrl;
}

export async function uploadSiteImage(file: Blob, siteId: string, category: "background" | "gallery") {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  const user = await getCurrentUser();
  if (!user) throw new Error("Vous devez être connecté.");
  const objectPath = `${user.id}/${siteId}/${category}/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from("site-media").upload(objectPath, file, {
    contentType: "image/webp", cacheControl: "31536000"
  });
  if (error) throw error;
  return supabase.storage.from("site-media").getPublicUrl(objectPath).data.publicUrl;
}

export async function signOut() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
