"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useProductLocale } from "../lib/product-i18n";
import { LanguageSwitch } from "./LanguageSwitch";

type AccountSection = "plans" | "billing" | "domains" | "data";

export function AccountShell({
  active,
  eyebrow,
  title,
  description,
  children
}: {
  active: AccountSection;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { locale, tr } = useProductLocale();
  const accountLinks: Array<{ href: string; label: string; section: AccountSection }> = [
    { href: "/plans", label: tr("Mon offre", "My plan"), section: "plans" },
    { href: "/billing", label: tr("Facturation", "Billing"), section: "billing" },
    { href: "/domains", label: tr("Domaines", "Domains"), section: "domains" },
    { href: "/data", label: tr("Mes données", "My data"), section: "data" }
  ];

  return (
    <main className="account-shell">
      <header className="account-topbar">
        <Link href="/builder" className="account-brand">
          <span className="account-brand-mark" aria-hidden="true">A</span>
          <span>
            <b>ELTARA</b>
            <small>{tr("Espace compte", "Account")}</small>
          </span>
        </Link>

        <div className="account-topbar-actions">
          <Link href="/builder" className="account-builder-shortcut">
            {tr("Ouvrir le Builder", "Open Builder")} <span aria-hidden="true">→</span>
          </Link>
          <LanguageSwitch compact />
        </div>
      </header>

      <div className="account-workspace">
        <aside className="account-sidebar">
          <nav className="account-nav" aria-label={tr("Navigation de votre compte", "Account navigation")}>
            <span className="account-nav-label">{tr("Produit", "Product")}</span>
            <Link href="/builder" className="account-nav-builder">
              <span aria-hidden="true">✦</span>
              <span>
                <b>Builder</b>
                <small>{tr("Créer et modifier votre site", "Create and edit your website")}</small>
              </span>
            </Link>

            <span className="account-nav-label account-nav-account-label">{tr("Votre compte", "Your account")}</span>
            {accountLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={item.section === active ? "active" : ""}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <Link className="account-pricing-link" href={locale === "en" ? "/pricing" : "/tarifs"}>
            <span>
              <b>{tr("Tarifs · comparer les offres", "Pricing · compare plans")}</b>
              <small>{tr("Essentiel, Growth et Création IA", "Essential, Growth and AI Launch")}</small>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        </aside>

        <section className="account-main">
          <section className="account-page-head">
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </section>

          <div className="account-content">{children}</div>
        </section>
      </div>
    </main>
  );
}
