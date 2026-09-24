export type SiteLanguage = "fr" | "en" | "both";

export type SiteConfig = {
  slug: string;
  firstName: string;
  lastName: string;
  brandName: string;
  language: SiteLanguage;
  heroTitle: string;
  heroSubtitle: string;
  aboutText: string;
  bookingLabel: string;
  bookingUrl: string;
  profileImageUrl: string;
  showTravelJournals: boolean;
  instagramUrl: string;
  facebookUrl: string;
};

export const requiredDisclaimer =
  "Site créé par un Ambassadeur Lifestyle indépendant MWR Life. Ce site n'est pas un site officiel de MWR Life ou Travel Advantage.";

export const defaultSiteConfig: SiteConfig = {
  slug: "alexandre-demo",
  firstName: "Alexandre",
  lastName: "Gallet",
  brandName: "AJG Voyage",
  language: "fr",
  heroTitle: "Découvrez une autre façon de voyager",
  heroSubtitle:
    "Une présentation simple et personnalisée de la plateforme Travel Advantage, de ses services voyage et de son fonctionnement.",
  aboutText:
    "Je partage ici ma façon d'utiliser la plateforme, mes voyages et ce que j'apprécie dans son fonctionnement.",
  bookingLabel: "Réserver une présentation",
  bookingUrl: "",
  profileImageUrl: "",
  showTravelJournals: true,
  instagramUrl: "",
  facebookUrl: ""
};
