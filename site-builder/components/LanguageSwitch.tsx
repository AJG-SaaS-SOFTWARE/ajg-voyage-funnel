"use client";

import { useProductLocale } from "../lib/product-i18n";

export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useProductLocale();
  return (
    <div className={compact ? "language-switch compact" : "language-switch"} role="group" aria-label={locale === "en" ? "Interface language" : "Langue de l’interface"}>
      <button type="button" className={locale === "fr" ? "active" : ""} aria-pressed={locale === "fr"} onClick={() => setLocale("fr")}>FR</button>
      <button type="button" className={locale === "en" ? "active" : ""} aria-pressed={locale === "en"} onClick={() => setLocale("en")}>EN</button>
    </div>
  );
}
