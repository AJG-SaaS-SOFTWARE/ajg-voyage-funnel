"use client";

import { useCallback, useEffect, useState } from "react";

export type ProductLocale = "fr" | "en";

const STORAGE_KEY = "ajg_builder_language";
const COOKIE_KEY = "ajg_builder_language";
const LOCALE_EVENT = "ajg-builder-locale-change";

function browserLocale(): ProductLocale {
  if (typeof window === "undefined") return "fr";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "fr" || stored === "en") return stored;
  return window.navigator.language.toLowerCase().startsWith("en") ? "en" : "fr";
}

function applyDocumentLocale(locale: ProductLocale) {
  document.documentElement.lang = locale;
}

export function useProductLocale() {
  const [locale, setLocaleState] = useState<ProductLocale>("fr");

  useEffect(() => {
    const sync = () => {
      const next = browserLocale();
      setLocaleState(next);
      applyDocumentLocale(next);
    };
    const syncFromEvent = (event: Event) => {
      const next = (event as CustomEvent<ProductLocale>).detail;
      if (next === "fr" || next === "en") {
        setLocaleState(next);
        applyDocumentLocale(next);
        return;
      }
      sync();
    };

    sync();
    window.addEventListener(LOCALE_EVENT, syncFromEvent);
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener(LOCALE_EVENT, syncFromEvent);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setLocale = useCallback((next: ProductLocale) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    document.cookie = `${COOKIE_KEY}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    applyDocumentLocale(next);
    window.dispatchEvent(new CustomEvent<ProductLocale>(LOCALE_EVENT, { detail: next }));
  }, []);

  const tr = useCallback(
    (fr: string, en: string) => (locale === "en" ? en : fr),
    [locale]
  );

  return { locale, setLocale, tr };
}
