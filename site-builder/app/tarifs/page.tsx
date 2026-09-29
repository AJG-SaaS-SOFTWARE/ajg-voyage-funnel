import type { Metadata } from "next";
import { PricingPage } from "../../components/PricingPage";

export const metadata: Metadata = {
  title: "Tarifs — AJG Site Builder",
  description: "Comparez les offres Essentiel et Pro IA d’AJG Site Builder."
};

export default function TarifsPage() {
  return <PricingPage locale="fr" />;
}
