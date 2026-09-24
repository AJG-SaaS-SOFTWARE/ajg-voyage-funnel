"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import SitePreview from "../../components/SitePreview";
import {
  defaultSiteConfig,
  requiredDisclaimer,
  type SiteConfig,
  type SiteLanguage
} from "../../lib/site-config";
import { loadDraft, publishDraft, saveDraft } from "../../lib/site-store";
import { isSupabaseConfigured } from "../../lib/supabase-browser";
import {
  getCurrentUser,
  getMySite,
  saveMySite,
  signOut,
  uploadProfileImage
} from "../../lib/supabase-site-repository";

const steps = [
  { key: "identity", label: "Identité" },
  { key: "story", label: "Message" },
  { key: "booking", label: "Rendez-vous" },
  { key: "options", label: "Options" },
  { key: "review", label: "Publication" }
] as const;

type StepKey = (typeof steps)[number]["key"];

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

export default function BuilderPage() {
  const router = useRouter();
  const remoteMode = isSupabaseConfigured();

  const [config, setConfig] = useState<SiteConfig>(defaultSiteConfig);
  const [step, setStep] = useState<StepKey>("identity");
  const [saved, setSaved] = useState(false);
  const [published, setPublished] = useState(false);
  const [ready, setReady] = useState(!remoteMode);
  const [busy, setBusy] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [remoteSiteId, setRemoteSiteId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const local = loadDraft();

      if (!remoteMode) {
        setConfig(local.config);
        setPublished(local.status === "published");
        setReady(true);
        return;
      }

      try {
        const user = await getCurrentUser();
        if (!user) {
          router.replace("/login");
          return;
        }
        if (cancelled) return;

        setUserEmail(user.email || "");
        const remote = await getMySite();
        if (cancelled) return;

        if (remote) {
          setConfig(remote.config);
          setRemoteSiteId(remote.id);
          setPublished(remote.status === "published");
        } else {
          setConfig(local.config);
          setPublished(false);
        }
      } catch (error) {
        if (!cancelled) {
          setSyncError(error instanceof Error ? error.message : "Impossible de charger le site.");
          setConfig(local.config);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [remoteMode, router]);

  const stepIndex = steps.findIndex((item) => item.key === step);
  const completion = Math.round(((stepIndex + 1) / steps.length) * 100);

  const update = <K extends keyof SiteConfig>(key: K, value: SiteConfig[K]) => {
    setSaved(false);
    setPublished(false);
    setSyncError("");
    setConfig((current) => ({ ...current, [key]: value }));
  };

  const errors = useMemo(() => {
    const next: string[] = [];
    if (!config.firstName.trim()) next.push("Prénom manquant");
    if (!config.lastName.trim()) next.push("Nom manquant");
    if (!config.brandName.trim()) next.push("Nom du site manquant");
    if (!config.slug.trim()) next.push("Sous-domaine manquant");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(config.slug)) next.push("Sous-domaine invalide");
    if (!config.heroTitle.trim()) next.push("Titre principal manquant");
    if (config.bookingUrl && !/^https?:\/\//i.test(config.bookingUrl)) {
      next.push("Lien de rendez-vous invalide");
    }
    return next;
  }, [config]);

  const save = async () => {
    setBusy(true);
    setSyncError("");
    try {
      saveDraft(config);
      if (remoteMode) {
        const remote = await saveMySite(config, false);
        setRemoteSiteId(remote.id);
      }
      setSaved(true);
      setPublished(false);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Erreur de sauvegarde.");
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (errors.length) return;
    setBusy(true);
    setSyncError("");
    try {
      if (remoteMode) {
        const remote = await saveMySite(config, true);
        setRemoteSiteId(remote.id);
      }
      publishDraft(config);
      setSaved(true);
      setPublished(true);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Erreur de publication.");
    } finally {
      setBusy(false);
    }
  };

  const uploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !remoteMode) return;

    setBusy(true);
    setSyncError("");
    try {
      const site = remoteSiteId
        ? { id: remoteSiteId }
        : await saveMySite(config, false);

      if (!remoteSiteId) setRemoteSiteId(site.id);

      const publicUrl = await uploadProfileImage(file, site.id);
      const nextConfig = { ...config, profileImageUrl: publicUrl };
      setConfig(nextConfig);
      saveDraft(nextConfig);
      const savedRemote = await saveMySite(nextConfig, false);
      setRemoteSiteId(savedRemote.id);
      setSaved(true);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Impossible d'envoyer la photo.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  };

  const logout = async () => {
    await signOut();
    router.replace("/login");
  };

  const go = (direction: number) => {
    const next = Math.min(Math.max(stepIndex + direction, 0), steps.length - 1);
    setStep(steps[next].key);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!ready) {
    return (
      <main className="loading-page">
        <div className="loading-dot" />
        <p>Chargement de votre site…</p>
      </main>
    );
  }

  return (
    <main className="builder-shell">
      <header className="builder-topbar">
        <Link href="/" className="brand-link">AJG Site Builder</Link>
        <div className="progress">
          <span style={{ width: completion + "%" }} />
        </div>
        <div className="topbar-account">
          <span>{remoteMode ? "Cloud" : "Local"} · {completion}%</span>
          {userEmail ? <button type="button" onClick={logout}>Déconnexion</button> : null}
        </div>
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
            <span className="status">
              {busy ? "Synchronisation…" : published ? "Publié" : saved ? "Sauvegardé" : "Brouillon"}
            </span>
          </div>

          {syncError ? <div className="error-card"><b>Synchronisation</b><p>{syncError}</p></div> : null}

          {step === "identity" ? (
            <>
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
                <Field label="Adresse souhaitée" hint="Exemple : julien-martin">
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
                            .replace(/^-|-$/g, "")
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

              {remoteMode ? (
                <Field
                  label="Photo de profil"
                  hint="JPEG, PNG, WebP ou AVIF. La photo est stockée dans votre espace Supabase."
                >
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={uploadPhoto} disabled={busy} />
                </Field>
              ) : (
                <Field label="Photo de profil — URL" hint="L'upload direct fonctionne dès que Supabase est configuré.">
                  <input
                    type="url"
                    placeholder="https://..."
                    value={config.profileImageUrl}
                    onChange={(e) => update("profileImageUrl", e.target.value)}
                  />
                </Field>
              )}

              {config.profileImageUrl ? (
                <div className="uploaded-photo">
                  <img src={config.profileImageUrl} alt="Aperçu de la photo de profil" />
                  <button type="button" onClick={() => update("profileImageUrl", "")}>Retirer</button>
                </div>
              ) : null}
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
                <p>
                  Le bouton IA viendra ici pour transformer quelques réponses personnelles en proposition de texte,
                  sans rendre la génération obligatoire.
                </p>
              </div>
            </>
          ) : null}

          {step === "booking" ? (
            <>
              <Field label="Texte du bouton">
                <input value={config.bookingLabel} onChange={(e) => update("bookingLabel", e.target.value)} />
              </Field>
              <Field label="Lien de rendez-vous" hint="Calendly, Google Calendar ou autre lien HTTPS.">
                <input
                  type="url"
                  placeholder="https://..."
                  value={config.bookingUrl}
                  onChange={(e) => update("bookingUrl", e.target.value)}
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
            </>
          ) : null}

          {step === "options" ? (
            <>
              <label className="option-card">
                <input
                  type="checkbox"
                  checked={config.showTravelJournals}
                  onChange={(e) => update("showTravelJournals", e.target.checked)}
                />
                <div>
                  <b>Mes voyages</b>
                  <p>Ajouter une section permettant de publier des carnets personnels comme Marrakech ou l'Andalousie.</p>
                </div>
              </label>
              <div className="locked">
                <span>Conformité verrouillée</span>
                <p>{requiredDisclaimer}</p>
              </div>
              <div className="helper-card">
                <b>Principe du produit</b>
                <p>
                  Les mentions obligatoires ne sont pas éditables par les membres. Elles sont gérées au niveau du
                  template et pourront être mises à jour pour tous les sites.
                </p>
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
                  <b>{remoteMode ? "Le site est prêt à être publié dans Supabase." : "Le site est prêt pour le prototype local."}</b>
                  <p>
                    {remoteMode
                      ? "Le contenu publié pourra être lu publiquement depuis le backend. Le raccordement du hostname réel vient ensuite."
                      : "Configurez Supabase pour rendre cette publication accessible depuis un autre appareil."}
                  </p>
                </div>
              )}
              <div className="publish-summary">
                <span>Adresse prévue</span>
                <strong>{config.slug}.voyage.ajgsolutionsgroup.com</strong>
                <span>Langue</span>
                <strong>{config.language === "both" ? "Français + English" : config.language.toUpperCase()}</strong>
                <span>Stockage</span>
                <strong>{remoteMode ? "Supabase" : "Navigateur local"}</strong>
              </div>
              <button
                type="button"
                className="primary publish-button"
                disabled={errors.length > 0 || busy}
                onClick={publish}
              >
                {busy ? "Publication…" : "Publier le site"}
              </button>
              {published ? (
                <Link className="text-link" href={"/site/" + config.slug}>Ouvrir le site publié →</Link>
              ) : null}
            </>
          ) : null}

          <div className="builder-actions">
            <button type="button" className="secondary" disabled={stepIndex === 0 || busy} onClick={() => go(-1)}>
              ← Retour
            </button>
            <button type="button" className="secondary" disabled={busy} onClick={save}>
              Sauvegarder
            </button>
            {stepIndex < steps.length - 1 ? (
              <button type="button" className="primary" disabled={busy} onClick={() => go(1)}>
                Continuer →
              </button>
            ) : null}
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
