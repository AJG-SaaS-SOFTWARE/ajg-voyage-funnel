"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { LanguageSwitch, useUiLanguage } from "./LanguageProvider";

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
  const { locale } = useUiLanguage();
  const links: Array<{ href: string; label: string; section?: AccountSection }> = [
    { href: "/builder", label: "Builder" },
    { href: "/plans", label: locale === "en" ? "My plan" : "Mon offre", section: "plans" },
    { href: "/billing", label: locale === "en" ? "Billing" : "Facturation", section: "billing" },
    { href: "/domains", label: locale === "en" ? "Domains" : "Domaines", section: "domains" },
    { href: "/data", label: locale === "en" ? "My data" : "Mes données", section: "data" }
  ];

  return (
    <main className="account-shell">
      <header className="account-topbar">
        <Link href="/builder" className="account-brand">
          <span className="account-brand-mark" aria-hidden="true">A</span>
          <span>
            <b>AJG Site Builder</b>
            <small>{locale === "en" ? "Account area" : "Espace compte"}</small>
          </span>
        </Link>

        <nav className="account-nav" aria-label={locale === "en" ? "Account navigation" : "Navigation de votre compte"}>
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={item.section === active ? "active" : ""}
            >
              {item.label}
            </Link>
          ))}
          <LanguageSwitch compact />
        </nav>
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
