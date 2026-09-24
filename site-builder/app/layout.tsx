import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AJG Site Builder — Prototype",
  description: "Prototype de création de sites personnalisés pour membres et ambassadeurs indépendants."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
