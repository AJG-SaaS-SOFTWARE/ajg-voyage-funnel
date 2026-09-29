import type { Metadata } from "next";
import { PricingPage } from "../../components/PricingPage";

const siteUrl = process.env.NEXT_PUBLIC_SITE_BUILDER_URL || "https://ajg-site-builder.vercel.app";

export const metadata: Metadata = {
  title: "Tarifs — AJG Site Builder",
  description: "Comparez les offres Essentiel et Pro IA d’AJG Site Builder.",
  alternates: {
    canonical: new URL("/tarifs", siteUrl),
    languages: {
      fr: new URL("/tarifs", siteUrl),
      en: new URL("/pricing", siteUrl),
      "x-default": new URL("/tarifs", siteUrl)
    }
  }
};

export default function TarifsPage() {
  return <PricingPage locale="fr" />;
}
