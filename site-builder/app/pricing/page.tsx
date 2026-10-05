import { growthAnnualIncludesLaunch } from "../../lib/growth-launch-offer";
import type { Metadata } from "next";
import { PricingPage } from "../../components/PricingPage";

export const metadata: Metadata = {
  title: "Pricing — ELTARA",
  description: "Compare ELTARA Essential, Growth and AI Launch.",
  alternates: {
    canonical: "https://ajg-site-builder.vercel.app/pricing",
    languages: {
      en: "https://ajg-site-builder.vercel.app/pricing",
      fr: "https://ajg-site-builder.vercel.app/tarifs",
      "x-default": "https://ajg-site-builder.vercel.app/tarifs"
    }
  }
};

export default function PricingRoutePage() {
  return <PricingPage locale="en" annualIncludesLaunch={growthAnnualIncludesLaunch()} />;
}
