import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { ProductLocaleProvider } from "../components/ProductLocaleProvider";
import type { ProductLocale } from "../lib/product-i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "AJG Site Builder",
  description: "AI-assisted website creation and publishing · Création et publication de sites assistées par IA."
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const routeLocale = headerStore.get("x-ajg-route-locale");
  const cookieLocale = cookieStore.get("ajg_builder_language")?.value;
  const browserLanguage = headerStore.get("accept-language") ?? "";
  const initialLocale: ProductLocale =
    routeLocale === "en" || routeLocale === "fr"
      ? routeLocale
      : cookieLocale === "en" || cookieLocale === "fr"
        ? cookieLocale
        : browserLanguage.toLowerCase().startsWith("en")
          ? "en"
          : "fr";

  return (
    <html lang={initialLocale}>
      <body>
        <ProductLocaleProvider initialLocale={initialLocale}>
          {children}
        </ProductLocaleProvider>
      </body>
    </html>
  );
}
