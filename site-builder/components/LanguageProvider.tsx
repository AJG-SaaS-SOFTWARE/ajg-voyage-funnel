"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  normalizeUiLocale,
  type UiLocale,
  UI_LOCALE_COOKIE,
  UI_LOCALE_STORAGE,
} from "../lib/i18n";

type LanguageContextValue = {
  locale: UiLocale;
  setLocale: (locale: UiLocale) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  initialLocale,
  children,
}: {
  initialLocale: UiLocale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<UiLocale>(initialLocale);

  useEffect(() => {
    const stored = normalizeUiLocale(window.localStorage.getItem(UI_LOCALE_STORAGE));
    if (stored !== locale && window.localStorage.getItem(UI_LOCALE_STORAGE)) {
      setLocaleState(stored);
      document.documentElement.lang = stored;
      document.cookie = `${UI_LOCALE_COOKIE}=${stored}; Path=/; Max-Age=31536000; SameSite=Lax`;
    }
  }, []);

  const setLocale = (next: UiLocale) => {
    const normalized = normalizeUiLocale(next);
    setLocaleState(normalized);
    window.localStorage.setItem(UI_LOCALE_STORAGE, normalized);
    document.cookie = `${UI_LOCALE_COOKIE}=${normalized}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.documentElement.lang = normalized;
  };

  const value = useMemo(() => ({ locale, setLocale }), [locale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useUiLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useUiLanguage must be used inside LanguageProvider");
  return value;
}

export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useUiLanguage();
  return (
    <button
      type="button"
      className={compact ? "text-button language-switch" : "button secondary language-switch"}
      onClick={() => setLocale(locale === "fr" ? "en" : "fr")}
      aria-label={locale === "fr" ? "Switch to English" : "Passer en français"}
      title={locale === "fr" ? "Switch to English" : "Passer en français"}
    >
      {locale === "fr" ? "EN" : "FR"}
    </button>
  );
}
