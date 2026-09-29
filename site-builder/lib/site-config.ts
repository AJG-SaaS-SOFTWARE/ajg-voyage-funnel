import { defaultSiteDesign, type SiteDesign } from "./site-design";
import { defaultSiteLegalConfig, type SiteLegalConfig } from "./site-legal";

export type SiteLanguage = "fr" | "en" | "both";
export type SitePageKind = "home" | "about" | "services" | "gallery" | "faq" | "contact" | "custom";
export type SitePageSection = { heading: string; text: string };
export type SitePagePlan = {
  id: string;
  slug: string;
  title: string;
  kind: SitePageKind;
  purpose: string;
  headline: string;
  intro: string;
  sections: SitePageSection[];
  enabled: boolean;
  assetIds: string[];
};
export type SiteArchitecture = { mode: "single" | "multi"; pages: SitePagePlan[] };
export type ContentAssetKind = "image" | "audio" | "text" | "document";
export type ContentAssetRights = "owned" | "licensed" | "public-domain" | "unknown";
export type ContentAsset = { id: string; kind: ContentAssetKind; name: string; url: string; text: string; rights: ContentAssetRights; sourceUrl: string; notes: string; publishable: boolean };
export type ContentLibrary = { assets: ContentAsset[] };

export type SiteConfig = {
  slug: string;
  firstName: string;
  lastName: string;
  brandName: string;
  language: SiteLanguage;
  heroTitle: string;
  heroSubtitle: string;
  heroTagline: string;
  aboutText: string;
  aboutHeading: string;
  bookingLabel: string;
  bookingUrl: string;
  profileImageUrl: string;
  showTravelJournals: boolean;
  instagramUrl: string;
  facebookUrl: string;
  design: SiteDesign;
  affiliation: "mwr" | "independent";
  legal: SiteLegalConfig;
  architecture: SiteArchitecture;
  contentLibrary: ContentLibrary;
};

export const requiredDisclaimer =
  "Site créé par un Ambassadeur Lifestyle indépendant MWR Life. Ce site n'est pas un site officiel de MWR Life ou Travel Advantage.";

export function siteDisclaimer(config: SiteConfig) {
  if (config.affiliation !== "mwr") return "";
  const usesMwr = config.design.showMwrLogo;
  const usesTravelAdvantage = config.design.showTravelAdvantageLogo ||
    /\btravel\s*advantage\b/i.test([config.heroTitle, config.heroSubtitle, config.aboutText, config.brandName].join(" "));
  if (usesMwr && !usesTravelAdvantage) {
    return "Site créé par un Ambassadeur Lifestyle indépendant MWR Life. Ce site n'est pas un site officiel de MWR Life.";
  }
  if (usesTravelAdvantage && !usesMwr) {
    return "Site créé par un Ambassadeur Lifestyle indépendant MWR Life. Ce site n'est pas un site officiel de Travel Advantage.";
  }
  return requiredDisclaimer;
}

export const defaultSiteConfig: SiteConfig = {
  slug: "",
  firstName: "",
  lastName: "",
  brandName: "",
  language: "fr",
  heroTitle: "Découvrez une autre façon de voyager",
  heroSubtitle:
    "Une présentation simple et personnalisée de la plateforme Travel Advantage, de ses services voyage et de son fonctionnement.",
  heroTagline: "",
  aboutText: "",
  aboutHeading: "",
  bookingLabel: "Réserver une présentation",
  bookingUrl: "",
  profileImageUrl: "",
  showTravelJournals: false,
  instagramUrl: "",
  facebookUrl: "",
  design: defaultSiteDesign,
  affiliation: "mwr",
  legal: defaultSiteLegalConfig,
  architecture: {
    mode: "single",
    pages: [{
      id: "home",
      slug: "",
      title: "Accueil",
      kind: "home",
      purpose: "Présenter l’activité et orienter le visiteur.",
      headline: "",
      intro: "",
      sections: [],
      enabled: true,
      assetIds: []
    }]
  },
  contentLibrary: { assets: [] }
};


export function normalizeSiteArchitecture(value: unknown): SiteArchitecture {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const allowedKinds = new Set<SitePageKind>(["home","about","services","gallery","faq","contact","custom"]);
  const rawPages = Array.isArray(input.pages) ? input.pages.slice(0, 6) : [];
  const clean = (v: unknown, max: number) => typeof v === "string" ? v.trim().slice(0, max) : "";
  const usedSlugs = new Set<string>();
  let homeSeen = false;
  const pages = rawPages.map((page: any, index) => {
    let kind = allowedKinds.has(page?.kind) ? page.kind as SitePageKind : "custom";
    if (kind === "home") {
      if (homeSeen) kind = "custom";
      else homeSeen = true;
    }
    let slug = kind === "home" ? "" : clean(page?.slug, 60).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || `page-${index + 1}`;
    if (kind !== "home") {
      const base = slug;
      let suffix = 2;
      while (usedSlugs.has(slug)) slug = `${base}-${suffix++}`.slice(0, 60);
      usedSlugs.add(slug);
    }
    const sections = (Array.isArray(page?.sections) ? page.sections : [])
      .slice(0, 4)
      .map((section: any) => ({
        heading: clean(section?.heading, 120),
        text: clean(section?.text, 1800)
      }))
      .filter((section: SitePageSection) => section.heading || section.text);
    return {
      id: clean(page?.id, 60) || `page-${index + 1}`,
      slug,
      title: clean(page?.title, 80) || "Page",
      kind,
      purpose: clean(page?.purpose, 240),
      headline: kind === "home" ? "" : clean(page?.headline, 120),
      intro: kind === "home" ? "" : clean(page?.intro, 600),
      sections: kind === "home" ? [] : sections,
      enabled: kind === "home" ? true : page?.enabled !== false,
      assetIds: [...new Set<string>((Array.isArray(page?.assetIds) ? page.assetIds : []).slice(0, 12).map((id: unknown) => clean(id, 80)).filter((id: string) => Boolean(id)))]
    };
  }).filter((page, index, all) => index === all.findIndex((item) => item.id === page.id));
  if (!pages.some((page) => page.kind === "home")) pages.unshift({
    id: "home",
    slug: "",
    title: "Accueil",
    kind: "home",
    purpose: "Présenter l’activité et orienter le visiteur.",
    headline: "",
    intro: "",
    sections: [],
    enabled: true,
    assetIds: []
  });
  return { mode: input.mode === "multi" && pages.filter((page) => page.enabled).length > 1 ? "multi" : "single", pages };
}

export function normalizeContentLibrary(value: unknown): ContentLibrary {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const kinds = new Set<ContentAssetKind>(["image","audio","text","document"]);
  const rights = new Set<ContentAssetRights>(["owned","licensed","public-domain","unknown"]);
  const clean = (v: unknown, max: number) => typeof v === "string" ? v.trim().slice(0, max) : "";
  const safeUrl = (v: unknown) => { const raw = clean(v, 2000); if (!raw) return ""; try { const u = new URL(raw); return u.protocol === "https:" ? u.toString() : ""; } catch { return ""; } };
  const assets = (Array.isArray(input.assets) ? input.assets : []).slice(0, 50).map((asset: any, index) => {
    const kind = kinds.has(asset?.kind) ? asset.kind as ContentAssetKind : "text";
    const assetRights = rights.has(asset?.rights) ? asset.rights as ContentAssetRights : "unknown";
    return { id: clean(asset?.id, 80) || `asset-${index + 1}`, kind, name: clean(asset?.name, 160) || "Contenu", url: safeUrl(asset?.url), text: clean(asset?.text, 12000), rights: assetRights, sourceUrl: safeUrl(asset?.sourceUrl), notes: clean(asset?.notes, 1000), publishable: asset?.publishable === true && assetRights !== "unknown" && (assetRights === "owned" || Boolean(safeUrl(asset?.sourceUrl))) };
  }).filter((asset, index, all) => index === all.findIndex((item) => item.id === asset.id));
  return { assets };
}
