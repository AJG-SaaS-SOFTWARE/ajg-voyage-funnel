"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SitePreview from "../../components/SitePreview";
import {
  defaultSiteConfig,
  requiredDisclaimer,
  type SiteConfig,
  type SiteLanguage
} from "../../lib/site-config";
import { loadDraft, publishDraft, saveDraft } from "../../lib/site-store";

const steps = [
  { key: "identity", label: "Identité" },
  { key: "story", label: "Message" },
  { key: "booking", label: "Rendez-vous" },
  { key: "options", label: "Options" },
  { key: "review", label: "Publication" }
] as const;

type StepKey = (typeof steps)[number]["key"];

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export default function BuilderPage() {
  const [config, setConfig] = useState<SiteConfig>(defaultSiteConfig);
  const [step, setStep] = useState<StepKey>("identity");
  const [saved, setSaved] = useState(false);
  const [published, setPublished] = useState(false);

  useEffect(() => {
    const draft = loadDraft();
    setConfig(draft.config);
    setPublished(draft.status === "published");
  }, []);

  const stepIndex = steps.findIndex((item) => item.key === step);
  const completion = Math.round(((stepIndex + 1) / steps.length) * 100);

  const update = <K extends keyof SiteConfig>(key: K, value: SiteConfig[K]) => {
    setSaved(false);
    setPublished(false);
    setConfig((current) => ({ ...current, [key]: value }));
  };

  const errors = useMemo(() => {
    const next: string[] = [];
    if (!config.firstName.trim()) next.push("Prénom manquant");
    if (!config.lastName.trim()) next.push("Nom manquant");
    if (!config.brandName.trim()) next.push("Nom du site manquant");
    if (!config.slug.trim()) next.push("Sous-domaine manquant");
    if (!config.heroTitle.trim()) next.push("Titre principal manquant");
    if (config.bookingUrl && !/^https?:\/\//i.test(config.bookingUrl)) next.push("Lien de rendez-vous invalide");
    return next;
  }, [config]);

  const save = () => {
    saveDraft(config);
    setSaved(true);
  };

  const publish = () => {
    if (errors.length) return;
    publishDraft(config);
    setSaved(true);
    setPublished(true);
  };

  const go = (direction: number) => {
    const next = Math.min(Math.max(stepIndex + direction, 0), steps.length - 1);
    setStep(steps[next].key);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="builder-shell">
      <header className="builder-topbar">
        <Link href="/" className="brand-link">AJG Site Builder</Link>
        <div className="progress">
          <span style={{ width: completion + "%" }} />
        </div>
        <span>{completion}%</span>
      </header>

      <div className="builder-layout">
        <aside className="step-nav">
          {steps.map((item, index) => (
            <button
              key={item.key}
              type="button"
              className={item.key === step ? "active" : ""}
              onClick={() => setStep(item.key)}
            >
              <span>{index + 1}</span>{item.label}
            </button>
          ))}
        </aside>

        <section className="panel editor builder-panel">
          <div className="panel-heading">
            <div>
              <p className="step">Étape {stepIndex + 1} sur {steps.length}</p>
              <h2>{steps[stepIndex].label}</h2>
            </div>
            <span className="status">{published ? "Publié" : saved ? "Sauvegardé" : "Brouillon"}</span>
          </div>

          {step === "identity" ? (
            <>
              <div className="grid two">
                <Field label="Prénom"><input value={config.firstName} onChange={(e) => update("firstName", e.target.value)} /></Field>
                <Field label="Nom"><input value={config.lastName} onChange={(e) => update("lastName", e.target.value)} /></Field>
              </div>
              <Field label="Nom affiché du site">
                <input value={config.brandName} onChange={(e) => update("brandName", e.target.value)} />
              </Field>
              <div className="grid two">
                <Field label="Adresse souhaitée" hint="Exemple : julien-martin">
                  <div className="slug-field">
                    <input
                      value={config.slug}
                      onChange={(e) => update("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"))}
                    />
                    <span>.voyage…</span>
                  </div>
                </Field>
                <Field label="Langue">
                  <select value={config.language} onChange={(e) => update("language", e.target.value as SiteLanguage)}>
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                    <option value="both">Français + English</option>
                  </select>
                </Field>
              </div>
              <Field label="Photo de profil — URL pour le prototype" hint="L'upload direct sera ajouté avec Supabase Storage.">
                <input type="url" placeholder="https://..." value={config.profileImageUrl} onChange={(e) => update("profileImageUrl", e.target.value)} />
              </Field>
            </>
          ) : null}

          {step === "story" ? (
            <>
              <Field label="Titre principal">
                <textarea rows={2} value={config.heroTitle} onChange={(e) => update("heroTitle", e.target.value)} />
              </Field>
              <Field label="Introduction">
                <textarea rows={5} value={config.heroSubtitle} onChange={(e) => update("heroSubtitle", e.target.value)} />
              </Field>
              <Field label="Votre présentation">
                <textarea rows={7} value={config.aboutText} onChange={(e) => update("aboutText", e.target.value)} />
              </Field>
              <div className="helper-card">
                <b>Assistant rédactionnel — prochaine étape</b>
                <p>Le bouton IA viendra ici pour transformer quelques réponses personnelles en proposition de texte, sans rendre la génération obligatoire.</p>
              </div>
            </>
          ) : null}

          {step === "booking" ? (
            <>
              <Field label="Texte du bouton">
                <input value={config.bookingLabel} onChange={(e) => update("bookingLabel", e.target.value)} />
              </Field>
              <Field label="Lien de rendez-vous" hint="Calendly, Google Calendar ou autre lien HTTPS.">
                <input type="url" placeholder="https://..." value={config.bookingUrl} onChange={(e) => update("bookingUrl", e.target.value)} />
              </Field>
              <div className="grid two">
                <Field label="Instagram"><input type="url" placeholder="https://instagram.com/..." value={config.instagramUrl} onChange={(e) => update("instagramUrl", e.target.value)} /></Field>
                <Field label="Facebook"><input type="url" placeholder="https://facebook.com/..." value={config.facebookUrl} onChange={(e) => update("facebookUrl", e.target.value)} /></Field>
              </div>
            </>
          ) : null}

          {step === "options" ? (
            <>
              <label className="option-card">
                <input type="checkbox" checked={config.showTravelJournals} onChange={(e) => update("showTravelJournals", e.target.checked)} />
                <div><b>Mes voyages</b><p>Ajouter une section permettant de publier des carnets personnels comme Marrakech ou l'Andalousie.</p></div>
              </label>
              <div className="locked">
                <span>Conformité verrouillée</span>
                <p>{requiredDisclaimer}</p>
              </div>
              <div className="helper-card">
                <b>Principe du produit</b>
                <p>Les mentions obligatoires ne seront pas éditables par les membres. Elles seront gérées au niveau du template et pourront être mises à jour pour tous les sites.</p>
              </div>
            </>
          ) : null}

          {step === "review" ? (
            <>
              {errors.length ? (
                <div className="error-card">
                  <b>À corriger avant publication</b>
                  <ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul>
                </div>
              ) : (
                <div className="success-card">
                  <b>Le site est prêt pour le prototype.</b>
                  <p>La publication ci-dessous est locale. Le branchement Supabase rendra ensuite cette URL accessible à d'autres personnes.</p>
                </div>
              )}
              <div className="publish-summary">
                <span>Adresse prévue</span>
                <strong>{config.slug}.voyage.ajgsolutionsgroup.com</strong>
                <span>Langue</span>
                <strong>{config.language === "both" ? "Français + English" : config.language.toUpperCase()}</strong>
              </div>
              <button type="button" className="primary publish-button" disabled={errors.length > 0} onClick={publish}>
                Publier le prototype
              </button>
              {published ? <Link className="text-link" href={"/site/" + config.slug}>Ouvrir le site publié →</Link> : null}
            </>
          ) : null}

          <div className="builder-actions">
            <button type="button" className="secondary" disabled={stepIndex === 0} onClick={() => go(-1)}>← Retour</button>
            <button type="button" className="secondary" onClick={save}>Sauvegarder</button>
            {stepIndex < steps.length - 1 ? <button type="button" className="primary" onClick={() => go(1)}>Continuer →</button> : null}
          </div>
        </section>

        <aside className="preview-wrap builder-preview">
          <div className="panel-heading">
            <div><p className="step">Aperçu live</p><h2>{config.brandName}</h2></div>
            <Link href="/preview">Plein écran</Link>
          </div>
          <SitePreview config={config} compact />
        </aside>
      </div>
    </main>
  );
}
