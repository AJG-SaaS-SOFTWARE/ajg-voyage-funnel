import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LanguageProvider } from "../components/LanguageProvider";
import { normalizeUiLocale, UI_LOCALE_COOKIE } from "../lib/i18n";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = normalizeUiLocale(cookieStore.get(UI_LOCALE_COOKIE)?.value);
  return {
    title: locale === "en" ? "AJG Site Builder" : "AJG Site Builder",
    description:
      locale === "en"
        ? "Create, customize and publish your website with guided AI assistance."
        : "Créez, personnalisez et publiez votre site avec un accompagnement IA guidé.",
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const locale = normalizeUiLocale(cookieStore.get(UI_LOCALE_COOKIE)?.value);

  return (
    <html lang={locale}>
      <body>
        <LanguageProvider initialLocale={locale}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
