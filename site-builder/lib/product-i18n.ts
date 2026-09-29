"use client";

import { useCallback, useEffect, useState } from "react";

export type ProductLocale = "fr" | "en";

const STORAGE_KEY = "ajg_builder_language";

function browserLocale(): ProductLocale {
  if (typeof window === "undefined") return "fr";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "fr" || stored === "en") return stored;
  return window.navigator.language.toLowerCase().startsWith("en") ? "en" : "fr";
}

export function useProductLocale() {
  const [locale, setLocaleState] = useState<ProductLocale>("fr");

  useEffect(() => {
    const next = browserLocale();
    setLocaleState(next);
    document.documentElement.lang = next;
  }, []);

  const setLocale = useCallback((next: ProductLocale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
  }, []);

  const tr = useCallback(
    (fr: string, en: string) => (locale === "en" ? en : fr),
    [locale]
  );

  return { locale, setLocale, tr };
}
