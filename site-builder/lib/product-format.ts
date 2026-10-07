export type ProductNumberLocale = "fr" | "en";

export function productIntlLocale(locale: ProductNumberLocale) {
  return locale === "en" ? "en-GB" : "fr-FR";
}

export function formatProductNumber(
  value: number,
  locale: ProductNumberLocale,
  minimumFractionDigits = 0,
  maximumFractionDigits = minimumFractionDigits
) {
  return new Intl.NumberFormat(productIntlLocale(locale), {
    minimumFractionDigits,
    maximumFractionDigits
  }).format(value);
}
