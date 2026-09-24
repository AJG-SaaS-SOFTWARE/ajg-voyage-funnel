"use client";

import { useEffect, useMemo, useState } from "react";
import {
  defaultSiteConfig,
  requiredDisclaimer,
  type SiteConfig,
  type SiteLanguage
} from "../lib/site-config";

const storageKey = "ajg-site-builder-prototype";

function Field({
  label,
  children,
  hint
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export default function Home() {
  const [config, setConfig] = useState<SiteConfig>(defaultSiteConfig);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;
    try {
      setConfig({ ...defaultSiteConfig, ...JSON.parse(raw) });
    } catch {}
  }, []);

  const publicPath = useMemo(
    () => `https://${config.slug || "prenom"}.voyage.ajgsolutionsgroup.com`,
    [config.slug]
  );

  const update = <K extends keyof SiteConfig>(key: K, value: SiteConfig[K]) => {
    setSaved(false);
    setConfig((current) => ({ ...current, [key]: value }));
  };

  const save = () => {
    window.localStorage.setItem(storageKey, JSON.stringify(config));
    setSaved(true);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${config.slug || "site"}-config.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="shell">
      <section className="intro">
        <p className="eyebrow">Prototype 01 · AJG Site Builder</p>
        <h1>Créer un site personnel sans toucher au code</h1>
        <p>
          Le premier prototype transforme AJG Voyage en modèle paramétrable. Le
          membre répond à quelques questions, renseigne ses liens et obtient un
          aperçu immédiat.
        </p>
      </section>

      <section className="workspace">
        <form className="panel editor" onSubmit={(event) => event.preventDefault()}>
          <div className="panel-heading">
            <div>
              <p className="step">Configuration</p>
              <h2>Identité et contenu</h2>
            </div>
            <span className="status">{saved ? "Sauvegardé" : "Brouillon"}</span>
          </div>

          <div className="grid two">
            <Field label="Prénom">
              <input value={config.firstName} onChange={(e) => update("firstName", e.target.value)} />
            </Field>
            <Field label="Nom">
              <input value={config.lastName} onChange={(e) => update("lastName", e.target.value)} />
            </Field>
          </div>

          <Field label="Nom affiché du site">
            <input value={config.brandName} onChange={(e) => update("brandName", e.target.value)} />
          </Field>

          <div className="grid two">
            <Field label="Adresse souhaitée" hint="Prototype : sous-domaine automatique.">
              <div className="slug-field">
                <input
                  value={config.slug}
                  onChange={(e) =>
                    update(
                      "slug",
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, "-")
                        .replace(/-+/g, "-")
                    )
                  }
                />
                <span>.voyage…</span>
              </div>
            </Field>
            <Field label="Langue">
              <select
                value={config.language}
                onChange={(e) => update("language", e.target.value as SiteLanguage)}
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
                <option value="both">Français + English</option>
              </select>
            </Field>
          </div>

          <Field label="Titre principal">
            <textarea
              rows={2}
              value={config.heroTitle}
              onChange={(e) => update("heroTitle", e.target.value)}
            />
          </Field>

          <Field label="Texte d'introduction">
            <textarea
              rows={4}
              value={config.heroSubtitle}
              onChange={(e) => update("heroSubtitle", e.target.value)}
            />
          </Field>

          <Field label="Présentation personnelle">
            <textarea
              rows={5}
              value={config.aboutText}
              onChange={(e) => update("aboutText", e.target.value)}
            />
          </Field>

          <div className="grid two">
            <Field label="Texte du bouton de rendez-vous">
              <input
                value={config.bookingLabel}
                onChange={(e) => update("bookingLabel", e.target.value)}
              />
            </Field>
            <Field label="Lien Calendly / Google / autre">
              <input
                type="url"
                placeholder="https://..."
                value={config.bookingUrl}
                onChange={(e) => update("bookingUrl", e.target.value)}
              />
            </Field>
          </div>

          <Field label="Photo de profil — URL pour le prototype" hint="L'upload direct viendra avec le stockage Supabase.">
            <input
              type="url"
              placeholder="https://..."
              value={config.profileImageUrl}
              onChange={(e) => update("profileImageUrl", e.target.value)}
            />
          </Field>

          <div className="grid two">
            <Field label="Instagram">
              <input
                type="url"
                placeholder="https://instagram.com/..."
                value={config.instagramUrl}
                onChange={(e) => update("instagramUrl", e.target.value)}
              />
            </Field>
            <Field label="Facebook">
              <input
                type="url"
                placeholder="https://facebook.com/..."
                value={config.facebookUrl}
                onChange={(e) => update("facebookUrl", e.target.value)}
              />
            </Field>
          </div>

          <label className="check">
            <input
              type="checkbox"
              checked={config.showTravelJournals}
              onChange={(e) => update("showTravelJournals", e.target.checked)}
            />
            <span>Afficher une section « Mes voyages »</span>
          </label>

          <div className="locked">
            <span>Bloc conformité verrouillé</span>
            <p>{requiredDisclaimer}</p>
          </div>

          <div className="actions">
            <button type="button" className="primary" onClick={save}>
              Sauvegarder le brouillon
            </button>
            <button type="button" className="secondary" onClick={exportJson}>
              Exporter la configuration
            </button>
          </div>
        </form>

        <aside className="panel preview-wrap">
          <div className="panel-heading">
            <div>
              <p className="step">Aperçu</p>
              <h2>Site généré</h2>
            </div>
            <a href={publicPath} onClick={(e) => e.preventDefault()}>
              {publicPath.replace("https://", "")}
            </a>
          </div>

          <div className="site-preview">
            <nav>
              <strong>{config.brandName || "Votre site"}</strong>
              <span>Voyages</span>
              <span>Présentation</span>
            </nav>

            <section className="preview-hero">
              <div>
                <p className="mini">Voyage d'abord · découverte ensuite</p>
                <h3>{config.heroTitle || "Votre titre"}</h3>
                <p>{config.heroSubtitle || "Votre texte d'introduction."}</p>
                <button>{config.bookingLabel || "Réserver"}</button>
              </div>
              <div className="portrait">
                {config.profileImageUrl ? (
                  <img src={config.profileImageUrl} alt="" />
                ) : (
                  <span>{(config.firstName?.[0] || "A") + (config.lastName?.[0] || "")}</span>
                )}
              </div>
            </section>

            <section className="preview-about">
              <p className="mini">Qui suis-je ?</p>
              <h4>
                {config.firstName} {config.lastName}
              </h4>
              <p>{config.aboutText}</p>
            </section>

            {config.showTravelJournals ? (
              <section className="preview-trips">
                <p className="mini">Mes voyages</p>
                <div className="trip-grid">
                  <article><b>Marrakech</b><span>Carnet personnel</span></article>
                  <article><b>Andalousie</b><span>Photos & impressions</span></article>
                </div>
              </section>
            ) : null}

            <footer>{requiredDisclaimer}</footer>
          </div>
        </aside>
      </section>
    </main>
  );
}
