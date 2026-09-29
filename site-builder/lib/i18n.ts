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
