"use client";

import { useEffect } from "react";
import { useProductLocale } from "../lib/product-i18n";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";

export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useProductLocale();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    void supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) return;
      if (data.user.user_metadata?.ajg_builder_locale === locale) return;
      return supabase.auth.updateUser({
        data: {
          ...data.user.user_metadata,
          ajg_builder_locale: locale
        }
      });
    }).catch(() => undefined);
  }, [locale]);

  return (
    <div className={compact ? "language-switch compact" : "language-switch"} role="group" aria-label={locale === "en" ? "Interface language" : "Langue de l’interface"}>
      <button type="button" className={locale === "fr" ? "active" : ""} aria-pressed={locale === "fr"} onClick={() => setLocale("fr")}>FR</button>
      <button type="button" className={locale === "en" ? "active" : ""} aria-pressed={locale === "en"} onClick={() => setLocale("en")}>EN</button>
    </div>
  );
}
