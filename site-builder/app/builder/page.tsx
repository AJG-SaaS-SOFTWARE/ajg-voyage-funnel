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
  {
    key: "identity",
    label: "Identité",
    eyebrow: "Votre base",
    description: "Nom, adresse, langue et photo : les éléments qui rendent le site immédiatement personnel.",
    time: "2 min",
    guidance: "Commencez simplement par votre prénom et votre nom. Le nom du site et son adresse se préremplissent automatiquement."
  },
  {
    key: "story",
    label: "Message",
    eyebrow: "Votre voix",
    description: "Le titre, l'introduction et votre présentation. Le ton reste simple, humain et fidèle à vous.",
    time: "4 min",
    guidance: "Écrivez comme si vous expliquiez votre démarche à une connaissance. Quelques phrases naturelles suffisent."
  },
  {
    key: "booking",
    label: "Rendez-vous",
    eyebrow: "Passer à l'action",
    description: "Reliez votre agenda et vos réseaux pour transformer la visite en échange concret.",
    time: "2 min",
    guidance: "Collez votre lien Calendly ou Google Calendar si vous en avez un. Les réseaux sociaux restent facultatifs."
  },
  {
    key: "options",
    label: "Options",
    eyebrow: "Votre contenu",
    description: "Activez les modules utiles tout en gardant les éléments de conformité centralisés.",
    time: "1 min",
    guidance: "Choisissez seulement ce que vous souhaitez montrer. Vous pourrez modifier ces options plus tard."
  },
  {
    key: "review",
    label: "Publication",
    eyebrow: "Dernière vérification",
    description: "Contrôlez l'adresse, la langue et les informations essentielles avant la mise en ligne.",
    time: "1 min",
    guidance: "Relisez le résumé. Si tout est vert, vous pouvez publier puis partager votre lien."
  }
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
    <label className="field premium-field">
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
  const [origin, setOrigin] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [brandTouched, setBrandTouched] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    let cancelled = false;

    const boot = async () => {
      const local = loadDraft();

      if (!remoteMode) {
        setConfig(local.config);
        setBrandTouched(Boolean(local.config.brandName));
        setSlugTouched(Boolean(local.config.slug));
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
          setBrandTouched(Boolean(remote.config.brandName));
          setSlugTouched(Boolean(remote.config.slug));
          setRemoteSiteId(remote.id);
          setPublished(remote.status === "published");
        } else {
          setConfig(local.config);
          setBrandTouched(Boolean(local.config.brandName));
          setSlugTouched(Boolean(local.config.slug));
          setPublished(false);
        }
      } catch (error) {
        if (!cancelled) {
          setSyncError(error instanceof Error ? error.message : "Impossible de charger le site.");
          setConfig(local.config);
          setBrandTouched(Boolean(local.config.brandName));
          setSlugTouched(Boolean(local.config.slug));
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

  const publicPath = "/site/" + config.slug;
  const betaPublicUrl = origin ? origin + publicPath : publicPath;
  const targetPublicUrl = config.slug ? config.slug + ".voyage.ajgsolutionsgroup.com" : "Votre sous-domaine";

  const copyPublicUrl = async () => {
    try {
      await navigator.clipboard.writeText(betaPublicUrl);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("error");
    }
  };

  const stepIndex = steps.findIndex((item) => item.key === step);
  const currentStep = steps[stepIndex];
  const completion = Math.round(((stepIndex + 1) / steps.length) * 100);

  const update = <K extends keyof SiteConfig>(key: K, value: SiteConfig[K]) => {
    setSaved(false);
    setPublished(false);
    setSyncError("");
    setConfig((current) => {
      const next = { ...current, [key]: value };
      // Keep every edit safe locally, even before the user explicitly syncs to the cloud.
      saveDraft(next);
      return next;
    });
  };

  const slugify = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const updateIdentityName = (key: "firstName" | "lastName", value: string) => {
    setSaved(false);
    setPublished(false);
    setSyncError("");
    setConfig((current) => {
      const next = { ...current, [key]: value };
      const first = key === "firstName" ? value : current.firstName;
      const last = key === "lastName" ? value : current.lastName;
      const fullName = [first, last].filter(Boolean).join(" ").trim();

      if (!brandTouched) next.brandName = fullName;
      if (!slugTouched) next.slug = slugify([first, last].filter(Boolean).join("-"));

      saveDraft(next);
      return next;
    });
  };

  const nextStepLabel =
    stepIndex < steps.length - 1 ? steps[stepIndex + 1].label : "";

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

    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) {
      setSyncError("Format non pris en charge. Utilisez une image JPEG, PNG, WebP ou AVIF.");
      event.target.value = "";
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setSyncError("Cette image dépasse 8 Mo. Choisissez une photo plus légère avant l’envoi.");
      event.target.value = "";
      return;
    }

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
      <main className="loading-page premium-loading-page">
        <div className="loading-orbit"><span /></div>
        <p>Chargement de votre espace…</p>
      </main>
    );
  }

  return (
    <main className="builder-shell premium-builder-shell">
      <header className="builder-topbar premium-builder-topbar">
        <Link href="/" className="brand-link premium-brand-link">
          <span className="brand-mark">A</span>
          <span>
            <strong>AJG Site Builder</strong>
            <small>Prototype 0.8</small>
          </span>
        </Link>

        <div className="progress premium-progress" aria-label={"Progression " + completion + "%"}>
          <span style={{ width: completion + "%" }} />
        </div>

        <div className="topbar-account premium-topbar-account">
          <Link className="preview-shortcut" href="/preview">Aperçu</Link>
          <span className={"cloud-pill " + (remoteMode ? "online" : "local")}>
            <i />{remoteMode ? "Cloud" : "Local"} · {completion}%
          </span>
          {userEmail ? (
            <button type="button" className="account-button" onClick={logout} title={userEmail}>
              <span>{userEmail.charAt(0).toUpperCase()}</span>
              <b>Déconnexion</b>
            </button>
          ) : null}
        </div>
      </header>

      <div className="builder-layout premium-builder-layout">
        <aside className="step-nav premium-step-nav">
          <div className="step-nav-heading">
            <p className="eyebrow">Votre parcours</p>
            <h2>Construire le site</h2>
            <p>Avancez étape par étape. Vous pouvez revenir sur chaque section à tout moment.</p>
            <div className="beginner-promise">
              <span>✓</span>
              <p>Pas besoin de compétences techniques : remplissez simplement les questions, nous nous occupons du reste.</p>
            </div>
          </div>

          <div className="step-list">
            {steps.map((item, index) => {
              const isActive = item.key === step;
              const isDone = index < stepIndex;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={(isActive ? "active " : "") + (isDone ? "done" : "")}
                  onClick={() => setStep(item.key)}
                >
                  <span className="step-number">{isDone ? "✓" : index + 1}</span>
                  <span className="step-label">
                    <b>{item.label}</b>
                    <small>{item.eyebrow}</small>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="step-nav-footer">
            <span>Site</span>
            <strong>{config.brandName || "Nouveau site"}</strong>
            <small>{targetPublicUrl}</small>
          </div>
        </aside>

        <section className="panel editor builder-panel premium-builder-panel">
          <div className="panel-heading premium-panel-heading">
            <div className="step-copy">
              <p className="step">Étape {stepIndex + 1} sur {steps.length} · {currentStep.eyebrow}</p>
              <h1>{currentStep.label}</h1>
              <p className="step-description">{currentStep.description}</p>
            </div>
            <span aria-live="polite" className={"status premium-status " + (published ? "published" : saved ? "saved" : "draft")}>
              <i />
              {busy ? "Synchronisation…" : published ? "Publié" : saved ? "Sauvegardé" : "Brouillon"}
            </span>
          </div>

          <div className="editor-body">
            <div className="step-guidance-card">
              <div className="step-guidance-icon">?</div>
              <div>
                <span>Ce que vous avez à faire · environ {currentStep.time}</span>
                <p>{currentStep.guidance}</p>
              </div>
            </div>
            {syncError ? <div className="error-card premium-error-card"><b>Synchronisation</b><p>{syncError}</p></div> : null}

            {step === "identity" ? (
              <>
                <div className="section-kicker">
                  <span>01</span>
                  <div><b>Votre identité</b><p>Ces informations donnent le ton à tout le site.</p></div>
                </div>

                <div className="grid two">
                  <Field label="Prénom">
                    <input placeholder="Ex. Julie" value={config.firstName} onChange={(e) => updateIdentityName("firstName", e.target.value)} />
                  </Field>
                  <Field label="Nom">
                    <input placeholder="Ex. Martin" value={config.lastName} onChange={(e) => updateIdentityName("lastName", e.target.value)} />
                  </Field>
                </div>

                <Field label="Nom affiché du site" hint="Nous le préremplissons avec votre nom. Vous pouvez le remplacer par votre marque si vous en avez une.">
                  <input
                    placeholder="Ex. Julie Martin Voyages"
                    value={config.brandName}
                    onChange={(e) => {
                      setBrandTouched(true);
                      update("brandName", e.target.value);
                    }}
                  />
                </Field>

                <div className="grid two">
                  <Field label="Adresse souhaitée" hint="Exemple : julien-martin">
                    <div className="slug-field premium-slug-field">
                      <input
                        value={config.slug}
                        placeholder="julie-martin"
                        onChange={(e) => {
                          setSlugTouched(true);
                          update("slug", slugify(e.target.value));
                        }}
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

                <div className="section-kicker photo-kicker">
                  <span>02</span>
                  <div><b>Votre photo</b><p>Un visage réel renforce immédiatement la confiance.</p></div>
                </div>

                {remoteMode ? (
                  <Field
                    label="Photo de profil"
                    hint="JPEG, PNG, WebP ou AVIF · 8 Mo maximum. La photo est stockée dans votre espace Supabase."
                  >
                    <input className="file-input" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={uploadPhoto} disabled={busy} />
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
                  <div className="uploaded-photo premium-uploaded-photo">
                    <img src={config.profileImageUrl} alt="Aperçu de la photo de profil" />
                    <div>
                      <b>Photo chargée</b>
                      <button type="button" onClick={() => update("profileImageUrl", "")}>Retirer la photo</button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {step === "story" ? (
              <>
                <div className="section-kicker">
                  <span>01</span>
                  <div><b>Le premier message</b><p>Le visiteur doit comprendre en quelques secondes ce que vous lui proposez.</p></div>
                </div>
                <div className="question-prompt">
                  <b>Imaginez qu'un ami arrive sur votre site.</b>
                  <p>Que voulez-vous qu'il comprenne en premier ? Écrivez simplement avec vos mots, sans chercher une formulation parfaite.</p>
                </div>
                <Field label="Titre principal">
                  <textarea rows={2} placeholder="Ex. Une autre façon de préparer et profiter de vos voyages" value={config.heroTitle} onChange={(e) => update("heroTitle", e.target.value)} />
                </Field>
                <Field label="Introduction">
                  <textarea rows={5} placeholder="En 2 ou 3 phrases : ce que vous avez découvert, ce que cela vous apporte et pourquoi vous souhaitez le partager." value={config.heroSubtitle} onChange={(e) => update("heroSubtitle", e.target.value)} />
                </Field>

                <div className="section-kicker">
                  <span>02</span>
                  <div><b>Votre histoire</b><p>Quelques lignes suffisent si elles sonnent juste et restent personnelles.</p></div>
                </div>
                <Field label="Votre présentation">
                  <textarea rows={7} placeholder="Parlez de vous comme vous le feriez à quelqu'un que vous venez de rencontrer : votre rapport au voyage, votre expérience et ce que vous aimez partager." value={config.aboutText} onChange={(e) => update("aboutText", e.target.value)} />
                </Field>
                <div className="helper-card premium-helper-card ai-helper">
                  <span className="helper-icon">✦</span>
                  <div>
                    <b>Assistant rédactionnel — prochaine étape</b>
                    <p>
                      L'IA pourra transformer quelques réponses personnelles en proposition de texte,
                      tout en vous laissant la validation finale.
                    </p>
                  </div>
                </div>
              </>
            ) : null}

            {step === "booking" ? (
              <>
                <div className="section-kicker">
                  <span>01</span>
                  <div><b>Votre rendez-vous</b><p>Un seul lien suffit pour transformer l'intérêt en échange.</p></div>
                </div>
                <Field label="Texte du bouton" hint="Ce texte apparaîtra sur le bouton principal de votre site.">
                  <input placeholder="Ex. Découvrir la plateforme" value={config.bookingLabel} onChange={(e) => update("bookingLabel", e.target.value)} />
                </Field>
                <Field label="Lien de rendez-vous" hint="Facultatif pour commencer. Copiez ici l'adresse de votre page Calendly, Google Calendar ou d'un autre agenda.">
                  <input
                    type="url"
                    placeholder="https://..."
                    value={config.bookingUrl}
                    onChange={(e) => update("bookingUrl", e.target.value)}
                  />
                </Field>

                <div className="section-kicker">
                  <span>02</span>
                  <div><b>Vos réseaux</b><p>Optionnels, mais utiles pour prolonger la relation hors du site.</p></div>
                </div>
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
                <div className="section-kicker">
                  <span>01</span>
                  <div><b>Modules du site</b><p>Gardez uniquement ce qui sert réellement votre présentation.</p></div>
                </div>
                <label className="option-card premium-option-card">
                  <input
                    type="checkbox"
                    checked={config.showTravelJournals}
                    onChange={(e) => update("showTravelJournals", e.target.checked)}
                  />
                  <span className="option-toggle" aria-hidden="true"><i /></span>
                  <div>
                    <b>Mes voyages</b>
                    <p>Activez cette option si vous souhaitez partager vos propres voyages et photos. Vous pourrez la désactiver plus tard.</p>
                  </div>
                </label>

                <div className="section-kicker">
                  <span>02</span>
                  <div><b>Conformité</b><p>Ces éléments restent protégés et communs à tous les sites.</p></div>
                </div>
                <div className="locked premium-locked">
                  <span>Conformité verrouillée</span>
                  <p>{requiredDisclaimer}</p>
                </div>
                <div className="helper-card premium-helper-card">
                  <b>Pourquoi c'est important</b>
                  <p>
                    Les mentions obligatoires ne sont pas éditables par les membres. Elles sont gérées au niveau du
                    template et pourront être mises à jour pour tous les sites.
                  </p>
                </div>
              </>
            ) : null}

            {step === "review" ? (
              <>
                <div className="section-kicker">
                  <span>✓</span>
                  <div><b>Contrôle final</b><p>Une dernière vérification avant de rendre le site accessible.</p></div>
                </div>
                {errors.length ? (
                  <div className="error-card premium-error-card">
                    <b>À corriger avant publication</b>
                    <ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul>
                  </div>
                ) : (
                  <div className="success-card premium-success-card review-success">
                    <div>
                      <b>{remoteMode ? "Le site est prêt à être publié." : "Le site est prêt pour le prototype local."}</b>
                      <p>
                        {remoteMode
                          ? "Les informations essentielles sont présentes. Vous pouvez lancer la publication."
                          : "Configurez Supabase pour rendre cette publication accessible depuis un autre appareil."}
                      </p>
                    </div>
                  </div>
                )}

                <div className="review-checklist">
                  <div className={config.firstName && config.lastName && config.brandName && config.slug ? "done" : ""}>
                    <span>{config.firstName && config.lastName && config.brandName && config.slug ? "✓" : "1"}</span>
                    <p><b>Identité</b><small>Nom du site et adresse</small></p>
                  </div>
                  <div className={config.heroTitle ? "done" : ""}>
                    <span>{config.heroTitle ? "✓" : "2"}</span>
                    <p><b>Message</b><small>Titre principal</small></p>
                  </div>
                  <div className={config.bookingUrl ? "done" : "optional"}>
                    <span>{config.bookingUrl ? "✓" : "○"}</span>
                    <p><b>Rendez-vous</b><small>{config.bookingUrl ? "Lien ajouté" : "Facultatif"}</small></p>
                  </div>
                  <div className="done">
                    <span>✓</span>
                    <p><b>Conformité</b><small>Gérée automatiquement</small></p>
                  </div>
                </div>

                <div className="publish-summary premium-publish-summary">
                  <div><span>Adresse cible</span><strong>{targetPublicUrl}</strong></div>
                  <div><span>Langue</span><strong>{config.language === "both" ? "Français + English" : config.language.toUpperCase()}</strong></div>
                  <div><span>Stockage</span><strong>{remoteMode ? "Supabase Cloud" : "Navigateur local"}</strong></div>
                  <div><span>État</span><strong>{published ? "Publié" : "Prêt à publier"}</strong></div>
                </div>

                <button
                  type="button"
                  className="primary publish-button premium-publish-button"
                  disabled={errors.length > 0 || busy}
                  onClick={publish}
                >
                  {busy ? "Publication…" : published ? "Republier les modifications" : "Publier le site"}
                  {!busy ? <span aria-hidden="true">→</span> : null}
                </button>
                {published ? (
                  <div className="published-share-card" aria-live="polite">
                    <div>
                      <span className="mini">Lien bêta partageable</span>
                      <strong>{betaPublicUrl}</strong>
                      <p>Ce lien fonctionne dès maintenant. Le sous-domaine personnalisé sera activé dans une étape ultérieure.</p>
                    </div>
                    <div className="published-share-actions">
                      <Link className="button secondary" href={publicPath} target="_blank">Ouvrir ↗</Link>
                      <button type="button" className="button primary" onClick={copyPublicUrl}>
                        {copyState === "copied" ? "✓ Lien copié" : copyState === "error" ? "Copie impossible" : "Copier le lien"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>

          <div className="builder-actions premium-builder-actions">
            <button type="button" className="secondary" disabled={stepIndex === 0 || busy} onClick={() => go(-1)}>
              ← Retour
            </button>
            <button type="button" className="secondary save-button" disabled={busy} onClick={save}>
              {saved && !busy ? "✓ Sauvegardé" : "Sauvegarder"}
            </button>
            {stepIndex < steps.length - 1 ? (
              <button type="button" className="primary premium-button" disabled={busy} onClick={() => go(1)}>
                Continuer : {nextStepLabel} <span aria-hidden="true">→</span>
              </button>
            ) : null}
          </div>
        </section>

        <aside className="preview-wrap builder-preview premium-builder-preview">
          <div className="panel-heading preview-panel-heading">
            <div>
              <p className="step">Aperçu live</p>
              <h2>{config.brandName}</h2>
            </div>
            <Link href="/preview">Plein écran ↗</Link>
          </div>
          <div className="preview-device-frame">
            <div className="device-dots"><i /><i /><i /></div>
            <SitePreview config={config} compact />
          </div>
          <div className="preview-note">
            <span>✦</span>
            <p>Vous voyez le résultat en direct. Rien n'est public avant l'étape « Publication ».</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
