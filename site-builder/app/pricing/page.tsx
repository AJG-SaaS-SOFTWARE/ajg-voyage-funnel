import type { Metadata } from "next";
import { PricingPage } from "../../components/PricingPage";

const siteUrl = process.env.NEXT_PUBLIC_SITE_BUILDER_URL || "https://ajg-site-builder.vercel.app";

export const metadata: Metadata = {
  title: "Pricing — AJG Site Builder",
  description: "Compare AJG Site Builder Essential and Pro AI plans.",
  alternates: {
    canonical: new URL("/pricing", siteUrl),
    languages: {
      en: new URL("/pricing", siteUrl),
      fr: new URL("/tarifs", siteUrl),
      "x-default": new URL("/tarifs", siteUrl)
    }
  }
};

export default function PricingRoutePage() {
  return <PricingPage locale="en" />;
}
