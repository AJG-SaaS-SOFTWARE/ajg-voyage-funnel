import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { ProductLocaleProvider } from "../components/ProductLocaleProvider";
import type { ProductLocale } from "../lib/product-i18n";
import "./globals.css";
import "./ajg-design-system.css";

async function requestLocale(): Promise<ProductLocale> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const explicitLocale = headerStore.get("x-ajg-product-locale");
  const cookieLocale = cookieStore.get("ajg_builder_language")?.value;
  const browserLanguage = headerStore.get("accept-language") ?? "";

  return explicitLocale === "en" || explicitLocale === "fr"
    ? explicitLocale
    : cookieLocale === "en" || cookieLocale === "fr"
      ? cookieLocale
      : browserLanguage.toLowerCase().startsWith("en")
        ? "en"
        : "fr";
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestLocale();
  const english = locale === "en";
  const description = english
    ? "ELTARA turns your activity into a professional digital presence, from creation to publishing, with AI assistance."
    : "ELTARA transforme votre activité en présence digitale professionnelle, de la création à la publication, avec l’assistance de l’IA.";
  const socialDescription = english
    ? "Build, publish and improve your professional website with a guided AI-assisted workspace."
    : "Élevez votre présence digitale avec un espace guidé pour créer, publier et faire évoluer votre site professionnel.";

  return {
    applicationName: "ELTARA",
    title: {
      default: "ELTARA — by AJG Horizon",
      template: "%s | ELTARA"
    },
    description,
    keywords: english
      ? ["ELTARA", "website builder", "professional website", "AI", "digital presence"]
      : ["ELTARA", "création de site", "site professionnel", "IA", "présence digitale"],
    authors: [{ name: "AJG Horizon" }],
    creator: "AJG Horizon",
    publisher: "AJG Horizon",
    openGraph: {
      type: "website",
      siteName: "ELTARA",
      title: "ELTARA — by AJG Horizon",
      description: socialDescription
    },
    twitter: {
      card: "summary",
      title: "ELTARA — by AJG Horizon",
      description: english
        ? "Build and grow your digital presence."
        : "Élevez votre présence digitale."
    }
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const initialLocale = await requestLocale();

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
