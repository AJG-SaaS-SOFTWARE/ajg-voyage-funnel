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
  const links: Array<{ href: string; label: string; section?: AccountSection }> = [
    { href: "/builder", label: "Builder" },
    { href: locale === "en" ? "/pricing" : "/tarifs", label: tr("Tarifs", "Pricing") },
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
            <b>AJG Site Builder</b>
            <small>{tr("Espace compte", "Account")}</small>
          </span>
        </Link>

        <nav className="account-nav" aria-label={tr("Navigation de votre compte", "Account navigation")}>
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={item.section === active ? "active" : ""}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <LanguageSwitch compact />
      </header>

      <section className="account-page-head">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </section>

      <div className="account-content">{children}</div>
    </main>
  );
}
