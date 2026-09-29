"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getProductLocale,
  LOCALE_EVENT,
  persistProductLocale,
  ProductLocaleContext,
  type ProductLocale
} from "../lib/product-i18n";

export function ProductLocaleProvider({
  initialLocale,
  children
}: {
  initialLocale: ProductLocale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<ProductLocale>(initialLocale);

  useEffect(() => {
    const stored = getProductLocale();
    if (stored !== locale) {
      setLocaleState(stored);
      document.documentElement.lang = stored;
    }

    const onStorage = () => {
      const next = getProductLocale();
      setLocaleState(next);
      document.documentElement.lang = next;
    };
    const onLocaleEvent = (event: Event) => {
      const next = (event as CustomEvent<ProductLocale>).detail;
      if (next !== "fr" && next !== "en") return;
      setLocaleState(next);
      document.documentElement.lang = next;
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(LOCALE_EVENT, onLocaleEvent);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(LOCALE_EVENT, onLocaleEvent);
    };
  }, []);

  const setLocale = useCallback((next: ProductLocale) => {
    setLocaleState(next);
    persistProductLocale(next);
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return (
    <ProductLocaleContext.Provider value={value}>
      {children}
    </ProductLocaleContext.Provider>
  );
}
