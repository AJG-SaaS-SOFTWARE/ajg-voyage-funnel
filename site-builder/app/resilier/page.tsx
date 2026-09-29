import type { Metadata } from "next";
import { CommercialLegalPage } from "../../components/CommercialLegalPage";

export const metadata: Metadata = {
  title: "Résiliation — AJG Site Builder",
  robots: { index: true, follow: true }
};

export default function Page() {
  return <CommercialLegalPage locale="fr" kind="cancel" />;
}
