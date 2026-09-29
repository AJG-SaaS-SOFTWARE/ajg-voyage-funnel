export const uiLocales = ["fr", "en"] as const;
export type UiLocale = (typeof uiLocales)[number];

export const UI_LOCALE_COOKIE = "ajg_builder_locale";
export const UI_LOCALE_STORAGE = "ajg_builder_locale";

export function normalizeUiLocale(value: unknown): UiLocale {
  return value === "en" ? "en" : "fr";
}

export function tr(locale: UiLocale | string, fr: string, en: string) {
  return normalizeUiLocale(locale) === "en" ? en : fr;
}

export function getClientUiLocale(): UiLocale {
  if (typeof window === "undefined") return "fr";
  const stored = window.localStorage.getItem(UI_LOCALE_STORAGE);
  if (stored === "en" || stored === "fr") return stored;
  const cookie = document.cookie.split(";").map((value) => value.trim()).find((value) => value.startsWith(UI_LOCALE_COOKIE + "="));
  return normalizeUiLocale(cookie?.split("=")[1]);
}

export function clientTr(fr: string, en: string) {
  return getClientUiLocale() === "en" ? en : fr;
}
