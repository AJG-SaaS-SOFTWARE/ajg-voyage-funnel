import type { Metadata } from "next";
import { PricingPage } from "../../components/PricingPage";

export const metadata: Metadata = {
  title: "Tarifs — AJG Site Builder",
  description: "Comparez Essentiel, Growth et la Création IA d’AJG Site Builder.",
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
  return <PricingPage locale="fr" />;
}
