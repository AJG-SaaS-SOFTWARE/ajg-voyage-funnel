"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadDraft, resetDraft, type BuilderDraft } from "../lib/site-store";
import { isSupabaseConfigured } from "../lib/supabase-browser";
import { getCurrentUser, getMySite } from "../lib/supabase-site-repository";
import { LanguageSwitch, useUiLanguage } from "../components/LanguageProvider";

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.5 10V7.8a4.5 4.5 0 0 1 9 0V10" />
      <rect x="5.25" y="10" width="13.5" height="10" rx="2.4" />
      <path d="M12 14v2.4" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m14.7 5.3 4 4" />
      <path d="m4.5 19.5 3.8-.8L18.7 8.3a1.4 1.4 0 0 0 0-2l-1-1a1.4 1.4 0 0 0-2 0L5.3 15.7l-.8 3.8Z" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3.8h7l3 3V20H7z" />
      <path d="M14 3.8V7h3" />
      <path d="M9.5 11h5M9.5 14h5M9.5 17h3.4" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 4 8 4-8 4-8-4 8-4Z" />
      <path d="m4 12 8 4 8-4M4 16l8 4 8-4" />
    </svg>
  );
}

export default function Home() {
  const { locale } = useUiLanguage();
  const en = locale === "en";
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
    <main className="shell premium-home">
      <section className="dashboard-hero">
        <div className="intro premium-intro">
          <div className="builder-heading-row"><p className="eyebrow">AJG Site Builder · Prototype 0.10.2</p><LanguageSwitch compact /></div>
          <h1>{en ? "Your website in a few steps" : "Votre site en quelques étapes"}</h1>
          <p>
            {en ? "One workspace to create and maintain your website: identity, content, appointments, media, preview and publishing." : "Un seul moteur pour créer et maintenir les sites des membres : identité, contenu, rendez-vous, médias, aperçu et publication."}
          </p>
        </div>

        <div className="hero-art hero-photo-art" aria-hidden="true">
          <img
            className="hero-photo"
            src="https://images.pexels.com/photos/34851205/pexels-photo-34851205/free-photo-of-mediterranean-coastal-villa-with-scenic-mountain-view.jpeg?auto=compress&cs=tinysrgb&w=1600"
            alt=""
          />
          <span className="hero-photo-wash" />
          <span className="hero-orbit" />
          <span className="hero-star">✦</span>
          <span className="hero-photo-caption">{en ? "Create · publish · grow" : "Créer · publier · développer"}</span>
        </div>
      </section>

      <section className="connection-banner premium-connection">
        <span className={"connection-icon " + remoteStatus}><LockIcon /></span>
        <div>
          <b>
            {remoteStatus === "authenticated"
              ? (en ? "Connected to cloud" : "Connecté au cloud")
              : remoteStatus === "local"
                ? (en ? "Local prototype mode" : "Mode prototype local")
                : remoteStatus === "guest"
                  ? (en ? "Sign-in required" : "Connexion nécessaire")
                  : (en ? "Checking…" : "Vérification…")}
          </b>
          <p>
            {remoteStatus === "authenticated"
              ? (en ? "Your data can be saved to Supabase" : "Vos données peuvent être sauvegardées dans Supabase") + (email ? " · " + email : "") + "."
              : remoteStatus === "guest"
                ? (en ? "Sign in to save a real website and upload photos." : "Connectez-vous pour sauvegarder un vrai site et envoyer des photos.")
                : remoteStatus === "local"
                  ? (en ? "The builder works, but your data stays on this device." : "Le builder fonctionne, mais les données restent sur cet appareil.")
                  : (en ? "Connecting to the backend." : "Connexion au backend en cours.")}
          </p>
        </div>
        {remoteStatus === "guest" ? (
          <Link className="button primary premium-button" href="/login">
            {en ? "Sign in" : "Se connecter"} <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </section>

      <section className="dashboard-grid premium-dashboard-grid">
        <article className="panel dashboard-card premium-card create-card">
          <div className="card-copy">
            <span className="card-icon teal"><PencilIcon /></span>
            <p className="step">{en ? "Create" : "Créer"}</p>
            <h2>{draft?.config.brandName || (en ? "New website" : "Nouveau site")}</h2>
            <p>{en ? "Identity, copy, appointments, language, social links and website options." : "Identité, textes, rendez-vous, langues, réseaux sociaux et options du site."}</p>
            <div className="actions">
              <Link className="button primary premium-button" href={remoteStatus === "guest" ? "/login" : "/builder"}>
                {draft ? (en ? "Continue setup" : "Continuer la configuration") : (en ? "Get started" : "Commencer")} <span aria-hidden="true">→</span>
              </Link>
              <Link className="button secondary premium-secondary" href="/preview">{en ? "Preview" : "Voir l’aperçu"}</Link>
            </div>
          </div>
          <div className="card-art browser-art" aria-hidden="true">
            <div className="mini-browser mini-browser-back">
              <span /><span /><span />
              <i />
            </div>
            <div className="mini-browser mini-browser-front">
              <span /><span /><span />
              <i />
              <b />
            </div>
          </div>
        </article>

        <article className="panel dashboard-card premium-card state-card">
          <div className="card-copy">
            <span className="card-icon gold"><DocumentIcon /></span>
            <p className="step">{en ? "Status" : "État"}</p>
            <h2>{draft?.status === "published" ? (en ? "Published" : "Site publié") : (en ? "Draft" : "Brouillon")}</h2>
            <p>
              {draft?.status === "published"
                ? (en ? "Your website is published and available at its public address." : "Votre site est publié et accessible depuis son adresse publique.")
                : (en ? "Work at your own pace, then publish when everything is ready." : "Travaillez à votre rythme puis publiez quand les informations sont prêtes.")}
            </p>
            {draft?.status === "published" ? (
              <Link className="text-link" href={"/site/" + draft.config.slug}>{en ? "Open published website →" : "Ouvrir le site publié →"}</Link>
            ) : null}
          </div>
          <div className="card-art status-art" aria-hidden="true">
            <div className="status-sheet">
              <span className="status-bullet teal-dot" />
              <i />
              <span className="status-bullet gold-dot" />
              <i />
              <span className="status-bullet gray-dot" />
              <i />
            </div>
          </div>
        </article>

        <article className="panel dashboard-card premium-card architecture-card">
          <div className="card-copy">
            <span className="card-icon sage"><LayersIcon /></span>
            <p className="step">Architecture</p>
            <h2>{en ? "One engine, multiple websites" : "Un moteur, plusieurs sites"}</h2>
            <p>
              {en ? "Each website keeps its own configuration and media while shared product improvements remain centralized." : "Chaque membre possède sa configuration et ses médias. Les corrections du template restent centralisées et peuvent bénéficier à tout le réseau."}
            </p>
          </div>
          <div className="card-art stack-art" aria-hidden="true">
            <div className="stack-window stack-window-three"><i /></div>
            <div className="stack-window stack-window-two"><i /></div>
            <div className="stack-window stack-window-one"><i /></div>
          </div>
        </article>
      </section>

      <section className="danger-zone premium-danger-zone">
        <button type="button" className="text-button" onClick={reset}>{en ? "Reset local draft" : "Réinitialiser le brouillon local"}</button>
      </section>
    </main>
  );
}
