import type { Metadata } from "next";
import { CommercialLegalPage } from "../../components/CommercialLegalPage";

export const metadata: Metadata = {
  title: "Confidentialité — AJG Site Builder",
  robots: { index: process.env.AJG_COMMERCIAL_LEGAL_READY?.trim().toLowerCase() === "true", follow: true }
};

export default function Page() {
  return <CommercialLegalPage locale="fr" kind="privacy" />;
}
