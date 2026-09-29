import type { Metadata } from "next";
import { PricingPage } from "../../components/PricingPage";

export const metadata: Metadata = {
  title: "Pricing — AJG Site Builder",
  description: "Compare AJG Site Builder Essential and Pro AI plans."
};

export default function PricingRoutePage() {
  return <PricingPage locale="en" />;
}
