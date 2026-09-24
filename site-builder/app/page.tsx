"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadDraft, resetDraft, type BuilderDraft } from "../lib/site-store";
import { isSupabaseConfigured } from "../lib/supabase-browser";
import { getCurrentUser, getMySite } from "../lib/supabase-site-repository";

export default function Home() {
  const [draft, setDraft] = useState<BuilderDraft | null>(null);
  const [remoteStatus, setRemoteStatus] = useState<"checking" | "guest" | "authenticated" | "local">("checking");
  const [email, setEmail] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const local = loadDraft();

      if (!isSupabaseConfigured()) {
        if (!cancelled) {
          setDraft(local);
          setRemoteStatus("local");
        }
        return;
      }

      try {
        const user = await getCurrentUser();
        if (!user) {
          if (!cancelled) {
            setDraft(local);
            setRemoteStatus("guest");
          }
          return;
        }

        const remote = await getMySite();
        if (!cancelled) {
          setEmail(user.email || "");
          setRemoteStatus("authenticated");
          setDraft(
            remote
              ? {
                  config: remote.config,
                  status: remote.status === "published" ? "published" : "draft",
                  updatedAt: remote.updatedAt,
                  publishedAt: remote.publishedAt || undefined
                }
              : local
          );
        }
      } catch {
        if (!cancelled) {
          setDraft(local);
          setRemoteStatus("guest");
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const reset = () => {
    resetDraft();
    setDraft(loadDraft());
  };

  return (
    <main className="shell">
      <section className="intro">
        <p className="eyebrow">AJG Site Builder · Prototype 0.3</p>
        <h1>Votre site en quelques étapes</h1>
        <p>
          Un seul moteur pour créer et maintenir les sites des membres : identité, contenu,
          rendez-vous, médias, aperçu et publication.
        </p>
      </section>

      <section className="connection-banner">
        <span className={"connection-dot " + remoteStatus} />
        <div>
          <b>
            {remoteStatus === "authenticated"
              ? "Connecté au cloud"
              : remoteStatus === "local"
                ? "Mode prototype local"
                : remoteStatus === "guest"
                  ? "Connexion nécessaire"
                  : "Vérification…"}
          </b>
          <p>
            {remoteStatus === "authenticated"
              ? "Vos données peuvent être sauvegardées dans Supabase" + (email ? " · " + email : "") + "."
              : remoteStatus === "guest"
                ? "Connectez-vous pour sauvegarder un vrai site et envoyer des photos."
                : remoteStatus === "local"
                  ? "Le builder fonctionne, mais les données restent sur cet appareil."
                  : "Connexion au backend en cours."}
          </p>
        </div>
        {remoteStatus === "guest" ? <Link className="button primary" href="/login">Se connecter</Link> : null}
      </section>

      <section className="dashboard-grid">
        <article className="panel dashboard-card">
          <p className="step">Créer</p>
          <h2>{draft?.config.brandName || "Nouveau site"}</h2>
          <p>Identité, textes, rendez-vous, langues, réseaux sociaux et options du site.</p>
          <div className="actions">
            <Link className="button primary" href={remoteStatus === "guest" ? "/login" : "/builder"}>
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
              ? "Le site est marqué comme publié et peut être chargé depuis Supabase quand le backend est actif."
              : "Travaillez à votre rythme puis publiez quand les informations sont prêtes."}
          </p>
          {draft?.status === "published" ? (
            <Link className="text-link" href={"/site/" + draft.config.slug}>Ouvrir le site publié →</Link>
          ) : null}
        </article>

        <article className="panel dashboard-card">
          <p className="step">Architecture</p>
          <h2>Un moteur, plusieurs sites</h2>
          <p>
            Chaque membre possède sa configuration et ses médias. Les corrections du template
            restent centralisées et peuvent bénéficier à tout le réseau.
          </p>
        </article>
      </section>

      <section className="danger-zone">
        <button type="button" className="text-button" onClick={reset}>Réinitialiser le brouillon local</button>
      </section>
    </main>
  );
}
