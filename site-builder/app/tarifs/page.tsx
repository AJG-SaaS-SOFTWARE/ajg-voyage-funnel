import { growthAnnualIncludesLaunch } from "../../lib/growth-launch-offer";
import type { Metadata } from "next";
import { PricingPage } from "../../components/PricingPage";

export const metadata: Metadata = {
  title: "Tarifs — ELTARA",
  description: "Comparez Essentiel, Growth et la Création IA d’ELTARA.",
  alternates: {
    canonical: "https://ajg-site-builder.vercel.app/tarifs",
    languages: {
      fr: "https://ajg-site-builder.vercel.app/tarifs",
      en: "https://ajg-site-builder.vercel.app/pricing",
      "x-default": "https://ajg-site-builder.vercel.app/tarifs"
    }
  }
};

export default function TarifsPage() {
  return <PricingPage locale="fr" annualIncludesLaunch={growthAnnualIncludesLaunch()} />;
}
