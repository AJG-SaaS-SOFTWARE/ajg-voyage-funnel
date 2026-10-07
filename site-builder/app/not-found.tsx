"use client";

import Link from "next/link";
import { LanguageSwitch } from "../components/LanguageSwitch";
import { useProductLocale } from "../lib/product-i18n";

export default function NotFound() {
  const { tr } = useProductLocale();

  return (
    <main className="not-found" role="main">
      <div className="not-found-toolbar">
        <span>ELTARA</span>
        <LanguageSwitch compact />
      </div>
      <p className="eyebrow">404</p>
      <h1>{tr("Page introuvable", "Page not found")}</h1>
      <p>
        {tr(
          "Cette adresse n’existe pas ou n’est plus disponible. Revenez à ELTARA pour poursuivre votre parcours.",
          "This address does not exist or is no longer available. Return to ELTARA to continue your journey."
        )}
      </p>
      <Link className="button primary" href="/">
        {tr("Retour à ELTARA", "Back to ELTARA")}
      </Link>
    </main>
  );
}
