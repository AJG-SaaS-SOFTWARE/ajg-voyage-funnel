import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { ProductLocaleProvider } from "../components/ProductLocaleProvider";
import type { ProductLocale } from "../lib/product-i18n";
import "./globals.css";
import "./ajg-design-system.css";

export const metadata: Metadata = {
  applicationName: "ELTARA",
  title: {
    default: "ELTARA — by AJG Horizon",
    template: "%s | ELTARA"
  },
  description: "ELTARA transforme votre activité en présence digitale professionnelle, de la création à la publication, avec l’assistance de l’IA. · Build and grow your digital presence with AI-assisted creation and publishing.",
  keywords: ["ELTARA", "création de site", "site professionnel", "IA", "présence digitale", "website builder"],
  authors: [{ name: "AJG Horizon" }],
  creator: "AJG Horizon",
  publisher: "AJG Horizon"
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const cookieLocale = cookieStore.get("ajg_builder_language")?.value;
  const browserLanguage = headerStore.get("accept-language") ?? "";
  const initialLocale: ProductLocale =
    cookieLocale === "en" || cookieLocale === "fr"
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
