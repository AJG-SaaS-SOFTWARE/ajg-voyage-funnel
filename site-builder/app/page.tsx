"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadDraft, resetDraft, type BuilderDraft } from "../lib/site-store";
import { isSupabaseConfigured } from "../lib/supabase-browser";
import { getCurrentUser, getMySite } from "../lib/supabase-site-repository";
import { useProductLocale } from "../lib/product-i18n";
import { LanguageSwitch } from "../components/LanguageSwitch";
import { EltaraMark } from "../components/EltaraBrand";
import { deriveOnboardingCreationPath, deriveOnboardingProgress } from "../lib/onboarding";
import { getMyBetaAccess, getMyEntitlements, getMySiteAiAccess, getMySiteEntitlements, type BetaAccess } from "../lib/subscription";
import { trackProductEvent } from "../lib/product-analytics";

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
  const { locale, tr } = useProductLocale();
  const [draft, setDraft] = useState<BuilderDraft | null>(null);
  const [remoteStatus, setRemoteStatus] = useState<"checking" | "guest" | "authenticated" | "local">("checking");
  const [email, setEmail] = useState("");
  const [planName, setPlanName] = useState("");
  const [entitlementActive, setEntitlementActive] = useState(false);
  const [canCreateWithAi, setCanCreateWithAi] = useState(false);
  const [remoteSiteId, setRemoteSiteId] = useState<string | null>(null);
  const [betaAccess, setBetaAccess] = useState<BetaAccess>({ active: false, startsAt: null, expiresAt: null });

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

        const [remote, resolvedBetaAccess] = await Promise.all([
          getMySite(),
          getMyBetaAccess().catch(() => ({ active: false, startsAt: null, expiresAt: null }))
        ]);
        let resolvedPlanName = "";
        let resolvedEntitlementActive = false;
        let resolvedCanCreateWithAi = false;

        try {
          if (remote) {
            const [entitlements, aiAccess] = await Promise.all([
              getMySiteEntitlements(remote.id),
              getMySiteAiAccess(remote.id)
            ]);
            resolvedPlanName = entitlements.planName;
            resolvedEntitlementActive = ["active", "trialing"].includes(entitlements.status);
            resolvedCanCreateWithAi = aiAccess.canCreateSite;
          } else {
            const entitlements = await getMyEntitlements();
            resolvedPlanName = entitlements.planName;
            resolvedEntitlementActive = ["active", "trialing"].includes(entitlements.status);
          }
        } catch {
          // Onboarding remains usable even when entitlement details are temporarily unavailable.
        }

        if (!cancelled) {
          setEmail(user.email || "");
          setRemoteStatus("authenticated");
          setPlanName(resolvedPlanName);
          setEntitlementActive(resolvedEntitlementActive);
          setCanCreateWithAi(resolvedCanCreateWithAi);
          setRemoteSiteId(remote?.id || null);
          setBetaAccess(resolvedBetaAccess);
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

  const onboarding = draft
    ? deriveOnboardingProgress(
        draft.config,
        draft.status === "published" ? "published" : "draft"
      )
    : null;
  const onboardingHref =
    remoteStatus === "guest"
      ? "/login"
      : onboarding?.nextStep
        ? `/builder?step=${onboarding.nextStep}`
        : "/builder";
  const creationPath = onboarding
    ? deriveOnboardingCreationPath({
        progress: onboarding,
        canCreateWithAi,
        entitlementActive
      })
    : null;

  const trackOnboardingPath = (path: "manual" | "ai") => {
    if (remoteStatus !== "authenticated") return;
    void trackProductEvent(
      path === "ai" ? "onboarding_ai_selected" : "onboarding_manual_selected",
      remoteSiteId
    );
  };

  return (
    <main className="shell premium-home">
      <section className="dashboard-hero">
        <div className="intro premium-intro">
          <div className="builder-language-row">
            <div>
              <p className="eyebrow">ELTARA · by AJG Horizon</p>
              <p className="eltara-tagline">{tr("Élevez votre présence digitale", "Elevate your digital presence")}</p>
            </div>
            <LanguageSwitch compact />
          </div>
          <h1>{tr("Créez une présence digitale qui évolue avec votre activité", "Build a digital presence that grows with your business")}</h1>
          <p>{tr(
            "Décrivez votre activité. ELTARA vous guide pour structurer, personnaliser et publier un site professionnel qui peut évoluer avec vous.",
            "Describe your business. ELTARA guides you to structure, customize and publish a professional website designed to evolve with you."
          )}</p>
        </div>

        <div className="hero-art eltara-hero-art" aria-hidden="true">
          <span className="eltara-hero-glow eltara-hero-glow-one" />
          <span className="eltara-hero-glow eltara-hero-glow-two" />
          <EltaraMark className="eltara-hero-symbol" />
          <span className="hero-orbit" />
          <span className="hero-star">✦</span>
          <span className="eltara-hero-wordmark">ELTARA</span>
          <span className="hero-photo-caption">{tr("Création · personnalisation · publication", "Create · customize · publish")}</span>
        </div>
      </section>

      <section className="connection-banner premium-connection">
        <span className={"connection-icon " + remoteStatus}><LockIcon /></span>
        <div>
          <b>
            {remoteStatus === "authenticated"
              ? tr("Connecté au cloud", "Connected to cloud")
              : remoteStatus === "local"
                ? tr("Mode prototype local", "Local prototype mode")
                : remoteStatus === "guest"
                  ? tr("Connexion nécessaire", "Sign-in required")
                  : tr("Vérification…", "Checking…")}
          </b>
          <p>
            {remoteStatus === "authenticated"
              ? tr("Vos données peuvent être sauvegardées dans Supabase", "Your data can be saved to Supabase") + (email ? " · " + email : "") + "."
              : remoteStatus === "guest"
                ? tr("Connectez-vous pour sauvegarder un vrai site et envoyer des photos.", "Sign in to save a real website and upload photos.")
                : remoteStatus === "local"
                  ? tr("ELTARA fonctionne, mais les données restent sur cet appareil.", "ELTARA works, but data stays on this device.")
                  : tr("Connexion au backend en cours.", "Connecting to backend.")}
          </p>
        </div>
        <div className="actions">
          <Link className="button secondary premium-secondary" href={locale === "en" ? "/pricing" : "/tarifs"}>
            {tr("Voir les tarifs", "View pricing")}
          </Link>
          {remoteStatus === "guest" ? (
            <Link className="button primary premium-button" href="/login">
              {tr("Se connecter", "Sign in")} <span aria-hidden="true">→</span>
            </Link>
          ) : null}
        </div>
      </section>

      {betaAccess.active ? (
        <section className="panel beta-tester-mission" aria-label={tr("Mission bêta", "Beta mission")}>
          <div className="beta-tester-mission-head">
            <div>
              <p className="eyebrow">ELTARA Beta Tester</p>
              <h2>{tr("Testez le parcours comme un vrai client", "Test the journey like a real customer")}</h2>
              <p>
                {tr(
                  "Votre accès BUILD + Growth complet est gratuit pendant la bêta. L’objectif est de créer, publier puis nous signaler ce qui vous ralentit ou vous semble inutile.",
                  "Your full BUILD + Growth access is free during the beta. The goal is to create, publish, then tell us what slows you down or feels unnecessary."
                )}
              </p>
            </div>
            {betaAccess.expiresAt ? (
              <span className="beta-access-expiry">
                {tr("Accès jusqu’au", "Access until")}{" "}
                <b>{new Date(betaAccess.expiresAt).toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR")}</b>
              </span>
            ) : null}
          </div>
          <ol className="beta-mission-steps">
            <li className={onboarding && onboarding.completeCount >= 2 ? "done" : ""}>
              <span>{onboarding && onboarding.completeCount >= 2 ? "✓" : "1"}</span>
              <div><b>{tr("Créer une première version", "Create a first version")}</b><small>{tr("Manuellement ou avec le Concepteur IA.", "Manually or with the AI Site Architect.")}</small></div>
            </li>
            <li className={draft?.status === "published" ? "done" : ""}>
              <span>{draft?.status === "published" ? "✓" : "2"}</span>
              <div><b>{tr("Publier réellement", "Publish for real")}</b><small>{tr("Passez le Quality Check et ouvrez le site public.", "Pass the Quality Check and open the public site.")}</small></div>
            </li>
            <li>
              <span>3</span>
              <div><b>{tr("Tester comme un visiteur", "Test as a visitor")}</b><small>{tr("Mobile, navigation, CTA, lisibilité et vitesse perçue.", "Mobile, navigation, CTA, readability and perceived speed.")}</small></div>
            </li>
            <li>
              <span>4</span>
              <div><b>{tr("Envoyer un retour", "Send feedback")}</b><small>{tr("Un blocage, une idée ou ce qui devrait être plus simple.", "A blocker, an idea, or anything that should be simpler.")}</small></div>
            </li>
          </ol>
          <div className="actions beta-mission-actions">
            <Link className="button secondary" href={onboardingHref}>
              {draft?.status === "published" ? tr("Modifier le site", "Edit website") : tr("Continuer la mission", "Continue mission")}
            </Link>
            <Link className={draft?.status === "published" ? "button primary" : "button secondary"} href="/feedback">
              {tr("Donner mon retour", "Give feedback")} <span aria-hidden="true">→</span>
            </Link>
          </div>
          <small className="beta-mission-note">
            {tr(
              "La participation à la bêta n’active aucun abonnement Stripe et aucune conversion payante automatique.",
              "Beta participation does not activate a Stripe subscription or any automatic paid conversion."
            )}
          </small>
        </section>
      ) : null}

      {onboarding ? (
        <section className="panel onboarding-progress-card" aria-label={tr("Progression de création", "Website setup progress")}>
          <div className="onboarding-progress-head">
            <div>
              <p className="eyebrow">{tr("Votre progression", "Your progress")}</p>
              <h2>
                {onboarding.done
                  ? tr("Votre site est prêt et publié", "Your website is ready and published")
                  : tr("Reprenez exactement où vous en étiez", "Resume exactly where you left off")}
              </h2>
              <p>
                {onboarding.done
                  ? tr("Les étapes essentielles de mise en ligne sont terminées.", "The essential launch steps are complete.")
                  : `${onboarding.completeCount}/${onboarding.totalCount} ${tr("étapes essentielles terminées", "essential steps complete")}`}
              </p>
            </div>
            <strong>{onboarding.percent}%</strong>
          </div>
          <div className="onboarding-progress-track" aria-hidden="true">
            <span style={{ width: `${onboarding.percent}%` }} />
          </div>
          <ol className="onboarding-checklist">
            {onboarding.steps.map((item) => (
              <li key={item.key} className={item.complete ? "done" : item.key === onboarding.nextStep ? "next" : ""}>
                <span aria-hidden="true">{item.complete ? "✓" : item.key === onboarding.nextStep ? "→" : "○"}</span>
                <div>
                  <b>{locale === "en" ? item.labelEn : item.labelFr}</b>
                  <small>{locale === "en" ? item.detailEn : item.detailFr}</small>
                </div>
              </li>
            ))}
          </ol>
          {creationPath?.showChoice ? (
            <div className="onboarding-path-choice">
              <div>
                <b>{tr("Choisissez votre façon d’avancer", "Choose how you want to continue")}</b>
                <small>
                  {creationPath.mode === "ai_available"
                    ? tr(
                        `Votre accès ${planName || "actuel"} permet une création BUILD complète par IA. Vous pouvez aussi tout construire manuellement.`,
                        `Your ${planName || "current"} access includes full BUILD creation with AI. You can also build everything manually.`
                      )
                    : tr(
                        `Votre accès ${planName || "actuel"} permet le parcours manuel. La création BUILD complète reste une option distincte si vous souhaitez accélérer la première version.`,
                        `Your ${planName || "current"} access includes the manual path. Full BUILD creation remains a separate option if you want to accelerate the first version.`
                      )}
                </small>
              </div>
              <div className="actions">
                <Link className="button primary premium-button" href={onboardingHref} onClick={() => trackOnboardingPath("manual")}>
                  {tr("Créer moi-même", "Build it myself")}
                </Link>
                {creationPath.mode === "ai_available" ? (
                  <Link className="button secondary premium-secondary" href="/builder?step=story&focus=architect" onClick={() => trackOnboardingPath("ai")}>
                    {tr("Créer avec l’IA", "Create with AI")} <span aria-hidden="true">✦</span>
                  </Link>
                ) : (
                  <Link className="button secondary premium-secondary" href="/plans">
                    {tr("Voir Création IA", "View AI Launch")}
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="actions">
              <Link className="button primary premium-button" href={onboardingHref}>
                {onboarding.done
                  ? tr("Ouvrir ELTARA", "Open ELTARA")
                  : tr("Continuer l’installation", "Continue setup")} <span aria-hidden="true">→</span>
              </Link>
            </div>
          )}
          {!onboarding.done ? (
            <small className="onboarding-autosave-note">
              {tr("Votre brouillon est repris automatiquement et sauvegardé au fil des modifications.", "Your draft resumes automatically and is saved as you make changes.")}
            </small>
          ) : null}
        </section>
      ) : null}

      <section className="dashboard-grid premium-dashboard-grid">
        <article className="panel dashboard-card premium-card create-card">
          <div className="card-copy">
            <span className="card-icon teal"><PencilIcon /></span>
            <p className="step">{tr("Créer", "Create")}</p>
            <h2>{draft?.config.brandName || tr("Nouveau site", "New website")}</h2>
            <p>{tr("Identité, textes, rendez-vous, langues, réseaux sociaux et options du site.", "Identity, copy, bookings, languages, social networks and website options.")}</p>
            <div className="actions">
              <Link className="button primary premium-button" href={onboardingHref}>
                {draft ? tr("Continuer la configuration", "Continue setup") : tr("Commencer", "Start")} <span aria-hidden="true">→</span>
              </Link>
              <Link className="button secondary premium-secondary" href="/preview">{tr("Voir l’aperçu", "Preview")}</Link>
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
            <p className="step">{tr("État", "Status")}</p>
            <h2>{draft?.status === "published" ? tr("Site publié", "Website published") : tr("Brouillon", "Draft")}</h2>
            <p>
              {draft?.status === "published"
                ? tr("Votre site est publié et accessible depuis son adresse publique.", "Your website is published and available at its public address.")
                : tr("Travaillez à votre rythme puis publiez quand les informations sont prêtes.", "Work at your own pace, then publish when everything is ready.")}
            </p>
            {draft?.status === "published" ? (
              <Link className="text-link" href={"/site/" + draft.config.slug}>{tr("Ouvrir le site publié", "Open published website")} →</Link>
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
            <h2>{tr("Un moteur, plusieurs sites", "One engine, multiple websites")}</h2>
            <p>{tr(
              "Chaque site possède sa configuration et ses médias. Les améliorations du moteur restent centralisées.",
              "Each website has its own configuration and media. Engine improvements remain centralized."
            )}</p>
          </div>
          <div className="card-art stack-art" aria-hidden="true">
            <div className="stack-window stack-window-three"><i /></div>
            <div className="stack-window stack-window-two"><i /></div>
            <div className="stack-window stack-window-one"><i /></div>
          </div>
        </article>
      </section>

      <section className="danger-zone premium-danger-zone">
        <button type="button" className="text-button" onClick={reset}>{tr("Réinitialiser le brouillon local", "Reset local draft")}</button>
      </section>
      <footer className="builder-public-legal-footer">
        <Link href={locale === "en" ? "/legal" : "/mentions-legales"}>{tr("Mentions légales", "Legal notice")}</Link>
        <Link href={locale === "en" ? "/privacy" : "/confidentialite"}>{tr("Confidentialité", "Privacy")}</Link>
        <Link href={locale === "en" ? "/terms" : "/cgv"}>{tr("Conditions", "Terms")}</Link>
        <Link href={locale === "en" ? "/cancel" : "/resilier"}>{tr("Résiliation", "Cancellation")}</Link>
        <Link href="/support">{tr("Support & diagnostic", "Support & diagnostics")}</Link>
      </footer>
    </main>
  );
}
