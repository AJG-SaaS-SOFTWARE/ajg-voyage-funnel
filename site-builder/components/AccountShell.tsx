import Link from "next/link";
import type { ReactNode } from "react";

type AccountSection = "plans" | "billing" | "domains" | "data";

const links: Array<{ href: string; label: string; section?: AccountSection }> = [
  { href: "/builder", label: "Builder" },
  { href: "/plans", label: "Mon offre", section: "plans" },
  { href: "/billing", label: "Facturation", section: "billing" },
  { href: "/domains", label: "Domaines", section: "domains" },
  { href: "/data", label: "Mes données", section: "data" }
];

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
  return (
    <main className="account-shell">
      <header className="account-topbar">
        <Link href="/builder" className="account-brand">
          <span className="account-brand-mark" aria-hidden="true">A</span>
          <span>
            <b>AJG Site Builder</b>
            <small>Espace compte</small>
          </span>
        </Link>

        <nav className="account-nav" aria-label="Navigation de votre compte">
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
