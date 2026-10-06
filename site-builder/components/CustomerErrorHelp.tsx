"use client";

import Link from "next/link";
import { useProductLocale } from "../lib/product-i18n";
import { explainCustomerError } from "../lib/customer-error-guidance";

export function CustomerErrorHelp({ message }: { message?: string | null }) {
  const { locale, tr } = useProductLocale();
  const guidance = explainCustomerError(message);
  if (!guidance) return null;

  return (
    <aside className="customer-error-help" aria-label={tr("Aide liée à l’erreur", "Error guidance")}>
      <span aria-hidden="true">?</span>
      <div>
        <b>{locale === "en" ? guidance.titleEn : guidance.titleFr}</b>
        <p>{locale === "en" ? guidance.actionEn : guidance.actionFr}</p>
        <Link className="text-link" href={guidance.href}>
          {tr("Ouvrir l’aide correspondante", "Open the relevant help")} →
        </Link>
      </div>
    </aside>
  );
}
