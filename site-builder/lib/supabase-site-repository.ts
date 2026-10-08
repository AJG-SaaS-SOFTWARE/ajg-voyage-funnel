import type { User } from "@supabase/supabase-js";
import { defaultSiteConfig, normalizeContentLibrary, normalizeSiteArchitecture, type SiteConfig, type SiteLanguage } from "./site-config";
import { getSupabaseBrowserClient } from "./supabase-browser";
import { normalizeSiteDesign } from "./site-design";
import { normalizeSiteLegalConfig } from "./site-legal";
import { getProductLocale } from "./product-i18n";
import { managedHostname } from "./published-domain";

function clientTr(fr: string, en: string) {
  return getProductLocale() === "en" ? en : fr;
}

export type RemoteSite = {
  id: string;
  ownerId: string;
  slug: string;
  status: "draft" | "published" | "suspended";
  privacyState: "active" | "erasure_requested";
  erasureRequestedAt: string | null;
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
    affiliation: row.compliance_profile === "independent-v1" ? "independent" : "mwr",
    legal: normalizeSiteLegalConfig(row.legal_config),
    architecture: normalizeSiteArchitecture(row.design_assets?.architecture),
    contentLibrary: normalizeContentLibrary(row.design_assets?.contentLibrary)
  };
}

function draftFromRow(row: any, draft: any): SiteConfig {
  const published = configFromRow(row);
  if (!draft || typeof draft !== "object") return published;
  return { ...defaultSiteConfig, ...published, ...draft, design: normalizeSiteDesign(draft.design ?? published.design), legal: normalizeSiteLegalConfig(draft.legal ?? published.legal), architecture: normalizeSiteArchitecture(draft.architecture ?? published.architecture), contentLibrary: normalizeContentLibrary(draft.contentLibrary ?? published.contentLibrary) };
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
    design_assets: { ...config.design, architecture: config.architecture, contentLibrary: config.contentLibrary },
    legal_config: config.legal,
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
    privacyState: row.privacy_state === "erasure_requested" ? "erasure_requested" : "active",
    erasureRequestedAt: row.erasure_requested_at || null,
    config: draftFromRow(row, draft),
    publishedAt: row.published_at,
    updatedAt: row.updated_at
  };
}

async function ensureManagedDomain(siteId: string, slug: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error(clientTr("Supabase n’est pas configuré.", "Supabase is not configured."));

  const hostname = managedHostname(slug);

  const { data: existing, error: readError } = await supabase
    .from("domains")
    .select("id,hostname")
    .eq("site_id", siteId)
    .eq("kind", "managed_subdomain")
    .maybeSingle();

  if (readError) throw readError;

  if (existing) {
    return existing.hostname || hostname;
  }

  const { error } = await supabase.from("domains").insert({
    site_id: siteId,
    hostname,
    kind: "managed_subdomain",
    verification_status: "pending",
    is_primary: false
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

export async function getMySites(): Promise<RemoteSite[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const user = await getCurrentUser();
  if (!user) return [];
  const { data, error } = await supabase.from("sites").select("*").eq("owner_id", user.id).order("created_at", { ascending: true });
  if (error) throw error;
  return Promise.all((data || []).map(async (row: any) => {
    const { data: draft, error: draftError } = await supabase.from("site_drafts").select("config").eq("site_id", row.id).maybeSingle();
    if (draftError) throw draftError;
    return toRemote(row, draft?.config);
  }));
}

export async function getMySite(siteId?: string): Promise<RemoteSite | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const user = await getCurrentUser();
  if (!user) return null;

  let query = supabase.from("sites").select("*").eq("owner_id", user.id);
  query = siteId ? query.eq("id", siteId) : query.order("created_at", { ascending: true }).limit(1);
  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const { data: draft, error: draftError } = await supabase.from("site_drafts").select("config").eq("site_id", data.id).maybeSingle();
  if (draftError) throw draftError;
  return toRemote(data, draft?.config);
}

export type ContactMessage = {
  id: string;
  siteId: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  message: string;
  consentAt: string;
  createdAt: string;
};

export async function getMyContactMessages(siteId: string): Promise<ContactMessage[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("contact_messages")
    .select("id,site_id,sender_name,sender_email,subject,message,consent_at,created_at")
    .eq("owner_id", user.id)
    .eq("site_id", siteId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    siteId: row.site_id,
    senderName: row.sender_name,
    senderEmail: row.sender_email,
    subject: row.subject || "",
    message: row.message,
    consentAt: row.consent_at,
    createdAt: row.created_at
  }));
}

export async function deleteMyContactMessage(messageId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error(clientTr("Supabase n’est pas configuré.", "Supabase is not configured."));
  const user = await getCurrentUser();
  if (!user) throw new Error(clientTr("Vous devez être connecté.", "You must be signed in."));

  const { error } = await supabase
    .from("contact_messages")
    .delete()
    .eq("id", messageId)
    .eq("owner_id", user.id);

  if (error) throw error;
}

export async function saveMySite(config: SiteConfig, publish = false, siteId?: string): Promise<RemoteSite> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error(clientTr("Supabase n’est pas configuré.", "Supabase is not configured."));

  const user = await getCurrentUser();
  if (!user) throw new Error(clientTr("Vous devez être connecté.", "You must be signed in."));

  const existing = await getMySite(siteId);
  const publishConfig = config;
  if (existing?.id) {
    const { data: capabilities, error: capabilityError } = await supabase.rpc("get_my_site_capabilities", { p_site_id: existing.id });
    if (capabilityError) throw capabilityError;
    const capability = Array.isArray(capabilities) ? capabilities[0] : capabilities;
    if (!capability?.can_edit) throw new Error(clientTr("Ce site est actuellement en accès lecture et export. Régularisez l’abonnement pour reprendre les modifications.", "This website is currently limited to read and export access. Restore your subscription to resume editing."));
    if (publish && !capability?.can_publish) throw new Error(clientTr("La publication est temporairement indisponible pour ce site. Régularisez l’abonnement pour publier à nouveau.", "Publishing is temporarily unavailable for this website. Restore your subscription to publish again."));
  }
  const nextPayload = payload(user, publishConfig, publish ? "published" : "draft");

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

  const initialPayload = publish
    ? payload(user, publishConfig, "draft")
    : nextPayload;
  const { data, error } = await supabase
    .from("sites")
    .insert(initialPayload)
    .select("*")
    .single();

  if (error) throw error;
  let remote = toRemote(data);

  if (publish) {
    await assertSiteCapability(remote.id, "can_publish");
    const { data: published, error: publishError } = await supabase
      .from("sites")
      .update(payload(user, publishConfig, "published"))
      .eq("id", remote.id)
      .select("*")
      .single();
    if (publishError) throw publishError;
    remote = toRemote(published);
    await ensureManagedDomain(remote.id, remote.slug);
  }

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

async function assertSiteCapability(siteId: string, capability: "can_edit" | "can_import" | "can_publish") {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error(clientTr("Supabase n’est pas configuré.", "Supabase is not configured."));
  const { data, error } = await supabase.rpc("get_my_site_capabilities", { p_site_id: siteId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.[capability]) throw new Error(clientTr("Cette action est temporairement indisponible pour ce site. Régularisez l’abonnement depuis votre espace de facturation.", "This action is temporarily unavailable for this website. Restore your subscription from the billing area."));
}

export async function uploadProfileImage(file: File, siteId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error(clientTr("Supabase n’est pas configuré.", "Supabase is not configured."));

  const user = await getCurrentUser();
  if (!user) throw new Error(clientTr("Vous devez être connecté.", "You must be signed in."));
  await assertSiteCapability(siteId, "can_import");
  await assertStorageAllowance(siteId, file.size);

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

async function assertStorageAllowance(siteId: string, bytes: number) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error(clientTr("Supabase n’est pas configuré.", "Supabase is not configured."));
  const { data, error } = await supabase.rpc("can_upload_site_media", { p_site_id: siteId, p_bytes: bytes });
  if (error) throw error;
  if (data !== true) throw new Error(clientTr("Votre quota de stockage est atteint. Supprimez un média ou passez à une offre avec davantage de stockage.", "Your storage quota has been reached. Remove a media file or upgrade to a plan with more storage."));
}

export async function uploadSiteImage(file: Blob, siteId: string, category: "background" | "gallery") {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error(clientTr("Supabase n’est pas configuré.", "Supabase is not configured."));
  const user = await getCurrentUser();
  if (!user) throw new Error(clientTr("Vous devez être connecté.", "You must be signed in."));
  await assertSiteCapability(siteId, "can_import");
  await assertStorageAllowance(siteId, file.size);
  const objectPath = `${user.id}/${siteId}/${category}/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from("site-media").upload(objectPath, file, {
    contentType: "image/webp", cacheControl: "31536000"
  });
  if (error) throw error;
  return supabase.storage.from("site-media").getPublicUrl(objectPath).data.publicUrl;
}

export async function uploadContentAsset(file: File, siteId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error(clientTr("Supabase n’est pas configuré.", "Supabase is not configured."));
  const user = await getCurrentUser();
  if (!user) throw new Error(clientTr("Vous devez être connecté.", "You must be signed in."));
  await assertSiteCapability(siteId, "can_import");
  if (file.size > 15 * 1024 * 1024) throw new Error(clientTr("Ce fichier dépasse la limite de 15 Mo.", "This file exceeds the 15 MB limit."));

  const allowed = new Set(["image/jpeg","image/png","image/webp","image/avif","audio/mpeg","audio/mp4","audio/ogg","audio/wav","application/pdf","text/plain"]);
  if (!allowed.has(file.type)) throw new Error(clientTr("Format non pris en charge. Utilisez JPG, PNG, WebP, AVIF, MP3, M4A, OGG, WAV, PDF ou TXT.", "Unsupported format. Use JPG, PNG, WebP, AVIF, MP3, M4A, OGG, WAV, PDF or TXT."));
  await assertStorageAllowance(siteId, file.size);
  const extension = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const objectPath = `${user.id}/${siteId}/library/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("site-private-media").upload(objectPath, file, { contentType: file.type, cacheControl: "3600" });
  if (error) throw error;
  return `private://${objectPath}`;
}


export type SiteDomain = { id: string; hostname: string; kind: "managed_subdomain" | "custom_domain"; verificationStatus: "pending" | "verified" | "failed"; isPrimary: boolean };

export async function getMyDomains(siteId?: string): Promise<SiteDomain[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const site = await getMySite(siteId);
  if (!site) return [];
  const { data, error } = await supabase.from("domains").select("id,hostname,kind,verification_status,is_primary").eq("site_id", site.id).order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map((row: any) => ({ id: row.id, hostname: row.hostname, kind: row.kind, verificationStatus: row.verification_status, isPrimary: row.is_primary }));
}

export async function requestCustomDomain(hostname: string, siteId?: string): Promise<SiteDomain> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error(clientTr("Supabase n’est pas configuré.", "Supabase is not configured."));
  const site = await getMySite(siteId);
  if (!site) throw new Error(clientTr("Créez d’abord votre site.", "Create your website first."));
  const normalized = hostname.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
  const { data, error } = await supabase.rpc("request_my_custom_domain", { p_site_id: site.id, p_hostname: normalized });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error(clientTr("Impossible d’enregistrer ce domaine.", "Unable to save this domain."));
  return { id: row.id, hostname: row.hostname, kind: "custom_domain", verificationStatus: row.verification_status as SiteDomain["verificationStatus"], isPrimary: row.is_primary };
}

export async function syncSiteDomain(siteId:string,domainId:string){
 const locale=getProductLocale();const tr=(fr:string,en:string)=>locale==="en"?en:fr;
 const supabase=getSupabaseBrowserClient();if(!supabase)throw new Error(tr("Supabase n’est pas configuré.","Supabase is not configured."));
 const {data}=await supabase.auth.getSession();if(!data.session?.access_token)throw new Error(tr("Reconnectez-vous pour vérifier le domaine.","Sign in again to verify the domain."));
 const response=await fetch("/api/domains/sync",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${data.session.access_token}`,"X-AJG-Locale":locale},body:JSON.stringify({siteId,domainId,locale})});
 const result=await response.json();if(!response.ok){const detail=result?.vercel?.message||result?.vercel?.code;const fallback=tr("Vérification du domaine impossible.","Unable to verify the domain.");throw new Error(detail?`${result.error||fallback} · ${detail}`:(result.error||fallback));}
 return result as {ok:boolean;verified:boolean;ownershipVerified?:boolean;misconfigured?:boolean|null;verification:Array<{type?:string;domain?:string;value?:string;reason?:string}>};
}

export const syncCustomDomain = syncSiteDomain;

export async function removeCustomDomain(id: string) {
  const locale = getProductLocale();
  const tr = (fr: string, en: string) => locale === "en" ? en : fr;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error(tr("Supabase n’est pas configuré.", "Supabase is not configured."));
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error(tr("Reconnectez-vous pour retirer le domaine.", "Sign in again to remove the domain."));
  const response = await fetch("/api/domains/remove", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}`, "X-AJG-Locale": locale }, body: JSON.stringify({ domainId: id, locale }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || tr("Suppression impossible.", "Unable to remove domain."));
}

export async function signOut() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
