import { growthAnnualIncludesLaunch } from "../../lib/growth-launch-offer";
import type { Metadata } from "next";
import { PricingPage } from "../../components/PricingPage";
import { appBaseUrl } from "../../lib/app-url";

export function generateMetadata(): Metadata {
  const base = appBaseUrl();
  return {
    title: "Pricing",
    description: "Compare ELTARA Essential, Growth and AI Launch.",
    alternates: {
      canonical: `${base}/pricing`,
      languages: {
        en: `${base}/pricing`,
        fr: `${base}/tarifs`,
        "x-default": `${base}/tarifs`
      }
    }
  };
}

export default function PricingRoutePage() {
  return <PricingPage locale="en" annualIncludesLaunch={growthAnnualIncludesLaunch()} />;
}
