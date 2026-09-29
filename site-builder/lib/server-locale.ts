export type ServerProductLocale = "fr" | "en";

export function requestProductLocale(request: Request): ServerProductLocale {
  return request.headers.get("x-ajg-locale") === "en" ? "en" : "fr";
}

export function localize(
  locale: ServerProductLocale,
  fr: string,
  en: string
) {
  return locale === "en" ? en : fr;
}
