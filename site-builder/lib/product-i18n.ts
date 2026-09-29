"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ProductLocale = "fr" | "en";

export const STORAGE_KEY = "ajg_builder_language";
export const COOKIE_KEY = "ajg_builder_language";
export const LOCALE_EVENT = "ajg-builder-locale-change";

type ProductLocaleContextValue = {
  locale: ProductLocale;
  setLocale: (locale: ProductLocale) => void;
};

export const ProductLocaleContext = createContext<ProductLocaleContextValue | null>(null);

export function getProductLocale(): ProductLocale {
  if (typeof window === "undefined") return "fr";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "fr" || stored === "en") return stored;
  return window.navigator.language.toLowerCase().startsWith("en") ? "en" : "fr";
}

export function persistProductLocale(locale: ProductLocale) {
  window.localStorage.setItem(STORAGE_KEY, locale);
  document.cookie = `${COOKIE_KEY}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  document.documentElement.lang = locale;
  window.dispatchEvent(new CustomEvent<ProductLocale>(LOCALE_EVENT, { detail: locale }));
}

export function useProductLocale() {
  const context = useContext(ProductLocaleContext);
  const [fallbackLocale, setFallbackLocale] = useState<ProductLocale>("fr");

  useEffect(() => {
    if (context) return;
    const sync = () => {
      const next = getProductLocale();
      setFallbackLocale(next);
      document.documentElement.lang = next;
    };
    const syncFromEvent = (event: Event) => {
      const next = (event as CustomEvent<ProductLocale>).detail;
      if (next === "fr" || next === "en") {
        setFallbackLocale(next);
        document.documentElement.lang = next;
      } else {
        sync();
      }
    };
    sync();
    window.addEventListener(LOCALE_EVENT, syncFromEvent);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(LOCALE_EVENT, syncFromEvent);
      window.removeEventListener("storage", sync);
    };
  }, [context]);

  const fallbackSetLocale = useCallback((next: ProductLocale) => {
    persistProductLocale(next);
    setFallbackLocale(next);
  }, []);

  const locale = context?.locale ?? fallbackLocale;
  const setLocale = context?.setLocale ?? fallbackSetLocale;
  const tr = useCallback((fr: string, en: string) => (locale === "en" ? en : fr), [locale]);

  return useMemo(() => ({ locale, setLocale, tr }), [locale, setLocale, tr]);
}
