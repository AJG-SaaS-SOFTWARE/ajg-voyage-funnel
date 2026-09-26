import { defaultSiteDesign, type SiteDesign } from "./site-design";
import { defaultSiteLegalConfig, type SiteLegalConfig } from "./site-legal";

export type SiteLanguage = "fr" | "en" | "both";

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
  legal: defaultSiteLegalConfig
};
