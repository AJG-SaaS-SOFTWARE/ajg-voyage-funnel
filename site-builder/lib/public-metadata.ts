import type { Metadata } from "next";
import type { SiteConfig } from "./site-config";

const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 160;

function compact(value: unknown, max: number) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, max).trim()
    : "";
}

function comparable(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function siteBrand(config: SiteConfig) {
  return (
    compact(config.brandName, 80) ||
    compact([config.firstName, config.lastName].filter(Boolean).join(" "), 80) ||
    "Site"
  );
}

function composeTitle(primary: string, brand: string) {
  if (!primary || comparable(primary) === comparable(brand)) {
    return compact(brand || primary || "Site", MAX_TITLE_LENGTH);
  }

  const suffix = ` | ${brand}`;
  if (suffix.length >= MAX_TITLE_LENGTH) {
    return compact(brand, MAX_TITLE_LENGTH);
  }

  const available = MAX_TITLE_LENGTH - suffix.length;
  return `${compact(primary, available)}${suffix}`;
}

export function publicMetadataText(config: SiteConfig, pageTitle = "") {
  const brand = siteBrand(config);
  const primary = compact(pageTitle || config.heroTitle, 120) || brand;
  const fallback =
    config.language === "en"
      ? `Discover ${brand}.`
      : `Découvrez ${brand}.`;
  const description =
    compact(config.heroSubtitle, MAX_DESCRIPTION_LENGTH) ||
    compact(config.aboutText, MAX_DESCRIPTION_LENGTH) ||
    fallback;

  return {
    title: composeTitle(primary, brand),
    description
  };
}

export function legalMetadataLabel(
  config: SiteConfig,
  path: "mentions-legales" | "confidentialite" | "cookies"
) {
  if (path === "cookies") return "Cookies";
  if (config.language === "en") {
    return path === "mentions-legales" ? "Legal notice" : "Privacy";
  }
  return path === "mentions-legales" ? "Mentions légales" : "Confidentialité";
}

export function buildPublicMetadata(
  config: SiteConfig,
  {
    canonical,
    pageTitle = "",
    index = true
  }: {
    canonical: string;
    pageTitle?: string;
    index?: boolean;
  }
): Metadata {
  const { title, description } = publicMetadataText(config, pageTitle);

  return {
    title,
    description,
    alternates: { canonical },
    robots: { index, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      images: config.profileImageUrl ? [config.profileImageUrl] : undefined
    }
  };
}
