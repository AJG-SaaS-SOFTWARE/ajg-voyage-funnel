"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadDraft, resetDraft, type BuilderDraft } from "../lib/site-store";

export default function Home() {
  const [draft, setDraft] = useState<BuilderDraft | null>(null);

  useEffect(() => {
    setDraft(loadDraft());
  }, []);

  const reset = () => {
    resetDraft();
    setDraft(loadDraft());
  };

  return (
    <main className="shell">
      <section className="intro">
        <p className="eyebrow">AJG Site Builder · Prototype 0.2</p>
        <h1>Votre site en quelques étapes</h1>
        <p>
          Ce prototype transforme le modèle AJG Voyage en site personnalisable pour un membre du réseau,
          avec aperçu, sauvegarde et publication simulée.
        </p>
      </section>

      <section className="dashboard-grid">
        <article className="panel dashboard-card">
          <p className="step">Créer</p>
          <h2>{draft?.config.brandName || "Nouveau site"}</h2>
          <p>
            Identité, textes, rendez-vous, langues, réseaux sociaux et options du site.
          </p>
          <div className="actions">
            <Link className="button primary" href="/builder">
              {draft ? "Continuer la configuration" : "Commencer"}
            </Link>
            <Link className="button secondary" href="/preview">Voir l'aperçu</Link>
          </div>
        </article>

        <article className="panel dashboard-card">
          <p className="step">État</p>
          <h2>{draft?.status === "published" ? "Site publié" : "Brouillon"}</h2>
          <p>
            {draft?.status === "published"
              ? "La publication est simulée dans le navigateur pour le prototype. La prochaine étape branchera Supabase et un vrai domaine."
              : "Les changements restent locaux tant que la base de données n'est pas connectée."}
          </p>
          {draft?.status === "published" ? (
            <Link className="text-link" href={"/site/" + draft.config.slug}>Ouvrir le site publié →</Link>
          ) : null}
        </article>

        <article className="panel dashboard-card">
          <p className="step">Architecture</p>
          <h2>Un moteur, plusieurs sites</h2>
          <p>
            Chaque membre aura sa configuration et ses médias. Les mises à jour du template pourront être appliquées à tous les sites.
          </p>
        </article>
      </section>

      <section className="danger-zone">
        <button type="button" className="text-button" onClick={reset}>Réinitialiser le prototype local</button>
      </section>
    </main>
  );
}
