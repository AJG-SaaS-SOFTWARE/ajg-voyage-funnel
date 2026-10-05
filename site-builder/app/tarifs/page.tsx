import { growthAnnualIncludesLaunch } from "../../lib/growth-launch-offer";
import type { Metadata } from "next";
import { PricingPage } from "../../components/PricingPage";
import { appBaseUrl } from "../../lib/app-url";

export function generateMetadata(): Metadata {
  const base = appBaseUrl();
  return {
    title: "Tarifs",
    description: "Comparez Essentiel, Growth et la Création IA d’ELTARA.",
    alternates: {
      canonical: `${base}/tarifs`,
      languages: {
        en: `${base}/pricing`,
        fr: `${base}/tarifs`,
        "x-default": `${base}/tarifs`
      }
    }
  };
}

export default function TarifsPage() {
  return <PricingPage locale="fr" annualIncludesLaunch={growthAnnualIncludesLaunch()} />;
}
