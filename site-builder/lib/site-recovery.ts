import {
  defaultSiteConfig,
  normalizeContentLibrary,
  normalizeSiteArchitecture,
  type SiteConfig
} from "./site-config";
import { normalizeSiteDesign } from "./site-design";
import { normalizeSiteLegalConfig } from "./site-legal";

type RecoveryExport = {
  format?: string;
  site?: {
    id?: string;
    slug?: string;
    config?: Record<string, unknown>;
  };
  exportedAt?: string;
};

export type RecoveryPreview = {
  config: SiteConfig;
  exportedAt: string | null;
  sourceSlug: string;
};

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function siteConfigFromRecoveryExport(
  input: unknown,
  target: { id: string; slug: string }
): RecoveryPreview {
  if (!input || typeof input !== "object") throw new Error("invalid_recovery_file");
  const payload = input as RecoveryExport;
  if (!["ajg-builder-export-v2", "ajg-builder-export-v3"].includes(payload.format || "")) {
    throw new Error("unsupported_recovery_format");
  }
  if (!payload.site || payload.site.id !== target.id) {
    throw new Error("recovery_site_mismatch");
  }
  const raw = payload.site.config;
  if (!raw || typeof raw !== "object") throw new Error("invalid_recovery_file");

  const enabled = Array.isArray(raw.enabledLanguages)
    ? raw.enabledLanguages.filter((item): item is string => typeof item === "string")
    : [];
  const primary = stringValue(raw.primaryLanguage, "fr");
  const language: SiteConfig["language"] =
    enabled.includes("fr") && enabled.includes("en")
      ? "both"
      : primary === "en"
        ? "en"
        : "fr";

  const designAssets =
    raw.designAssets && typeof raw.designAssets === "object"
      ? raw.designAssets
      : {};

  const config: SiteConfig = {
    ...defaultSiteConfig,
    slug: target.slug,
    firstName: stringValue(raw.firstName),
    lastName: stringValue(raw.lastName),
    brandName: stringValue(raw.brandName),
    language,
    heroTitle: stringValue(raw.heroTitle),
    heroSubtitle: stringValue(raw.heroSubtitle),
    heroTagline: stringValue(raw.heroTagline),
    aboutText: stringValue(raw.aboutText),
    aboutHeading: stringValue(raw.aboutHeading),
    bookingLabel: stringValue(raw.bookingLabel),
    bookingUrl: stringValue(raw.bookingUrl),
    profileImageUrl: stringValue(raw.profileImageUrl),
    showTravelJournals: raw.showTravelJournals === true,
    instagramUrl: stringValue(raw.instagramUrl),
    facebookUrl: stringValue(raw.facebookUrl),
    design: normalizeSiteDesign(designAssets),
    legal: normalizeSiteLegalConfig(raw.legalConfig),
    architecture: normalizeSiteArchitecture((designAssets as Record<string, unknown>).architecture),
    contentLibrary: normalizeContentLibrary((designAssets as Record<string, unknown>).contentLibrary),
    affiliation: raw.complianceProfile === "independent-v1" ? "independent" : "mwr"
  };

  return {
    config,
    exportedAt: typeof payload.exportedAt === "string" ? payload.exportedAt : null,
    sourceSlug: stringValue(payload.site.slug, target.slug)
  };
}
