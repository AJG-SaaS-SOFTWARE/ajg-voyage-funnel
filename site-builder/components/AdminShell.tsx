import Link from "next/link";
import type { ReactNode } from "react";

type AdminSection = "overview" | "privacy" | "finops";

export function AdminShell({
  active,
  eyebrow,
  title,
  description,
  actions,
  children
}: {
  active: AdminSection;
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-brand-block">
          <span className="admin-brand-mark" aria-hidden="true">A</span>
          <div>
            <b>AJG Site Builder</b>
            <small>Back-office</small>
          </div>
        </div>

        <nav className="admin-nav" aria-label="Navigation administration">
          <Link
            href="/admin"
            className={active === "overview" ? "active" : ""}
          >
            Vue d’ensemble
          </Link>
          <Link
            href="/admin/privacy"
            className={active === "privacy" ? "active" : ""}
          >
            RGPD & effacement
          </Link>
          <Link href="/admin/finops" className={active === "finops" ? "active" : ""}>Coûts IA</Link>
          <Link href="/builder">Builder ↗</Link>
        </nav>
      </header>

      <section className="admin-page-head">
        <div className="admin-page-copy">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {actions ? <div className="admin-page-actions">{actions}</div> : null}
      </section>

      <div className="admin-content">{children}</div>
    </main>
  );
}
