"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadDraft, resetDraft, type BuilderDraft } from "../lib/site-store";
import { isSupabaseConfigured } from "../lib/supabase-browser";
import { getCurrentUser, getMySite } from "../lib/supabase-site-repository";
import { useProductLocale } from "../lib/product-i18n";
import { LanguageSwitch } from "../components/LanguageSwitch";
import { EltaraMark } from "../components/EltaraBrand";
import { BetaExperienceSwitch } from "../components/BetaExperienceSwitch";
import { deriveOnboardingCreationPath, deriveOnboardingProgress } from "../lib/onboarding";
import { getMyBetaAccess, getMyEntitlements, getMySiteAiAccess, getMySiteEntitlements, type BetaAccess } from "../lib/subscription";
import { getMyBetaJourneyProgress, trackProductEvent, type BetaJourneyProgress } from "../lib/product-analytics";
import { readBetaExperienceMode, writeBetaExperienceMode, type BetaExperienceMode } from "../lib/beta-experience-mode";

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
  const [planKey, setPlanKey] = useState<"free" | "essential" | "growth">("free");
  const [entitlementActive, setEntitlementActive] = useState(false);
  const [canCreateWithAi, setCanCreateWithAi] = useState(false);
  const [remoteSiteId, setRemoteSiteId] = useState<string | null>(null);
  const [betaAccess, setBetaAccess] = useState<BetaAccess>({ active: false, startsAt: null, expiresAt: null });
  const [betaExperienceMode, setBetaExperienceMode] = useState<BetaExperienceMode>("essential");
  const [betaJourney, setBetaJourney] = useState<BetaJourneyProgress>({
    essentialTested: false,
    growthTested: false,
    essentialThenGrowth: false,
    growthCockpitOpened: false,
    analyticsOpened: false,
    growthExplored: false,
    published: false,
    feedbackSent: false
  });

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
        let resolvedPlanKey: "free" | "essential" | "growth" = "free";
        let resolvedEntitlementActive = false;
        let resolvedCanCreateWithAi = false;

        try {
          if (remote) {
            const [entitlements, aiAccess] = await Promise.all([
              getMySiteEntitlements(remote.id),
              getMySiteAiAccess(remote.id)
            ]);
            resolvedPlanName = entitlements.planName;
            resolvedPlanKey = entitlements.planKey;
            resolvedEntitlementActive = ["active", "trialing"].includes(entitlements.status);
            resolvedCanCreateWithAi = aiAccess.canCreateSite;
          } else {
            const entitlements = await getMyEntitlements();
            resolvedPlanName = entitlements.planName;
            resolvedPlanKey = entitlements.planKey;
            resolvedEntitlementActive = ["active", "trialing"].includes(entitlements.status);
          }
        } catch {
          // Onboarding remains usable even when entitlement details are temporarily unavailable.
        }

        if (!cancelled) {
          setEmail(user.email || "");
          setRemoteStatus("authenticated");
          setPlanName(resolvedPlanName);
          setPlanKey(resolvedPlanKey);
          setEntitlementActive(resolvedEntitlementActive);
          setCanCreateWithAi(resolvedCanCreateWithAi);
          setRemoteSiteId(remote?.id || null);
          setBetaAccess(resolvedBetaAccess);
          if (resolvedBetaAccess.active) {
            setBetaExperienceMode(readBetaExperienceMode());
            void getMyBetaJourneyProgress(remote?.id || null)
              .then((progress) => {
                if (!cancelled) setBetaJourney(progress);
              })
              .catch(() => undefined);
          }
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
  const effectiveCanCreateWithAi =
    betaAccess.active && betaExperienceMode === "essential" ? false : canCreateWithAi;
  const experiencePlanName = betaAccess.active
    ? betaExperienceMode === "essential"
      ? tr("Essentiel · mode test", "Essential · test mode")
      : tr("Growth · mode test", "Growth · test mode")
    : planName;
  const growthExperienceAvailable =
    entitlementActive &&
    draft?.status === "published" &&
    (betaAccess.active ? betaExperienceMode === "growth" : planKey === "growth");
  const creationPath = onboarding
    ? deriveOnboardingCreationPath({
        progress: onboarding,
        canCreateWithAi: effectiveCanCreateWithAi,
        entitlementActive
      })
    : null;

  const betaMissionChecks = [
    betaJourney.essentialTested,
    betaJourney.published || draft?.status === "published",
    betaJourney.essentialThenGrowth,
    betaJourney.growthExplored,
    betaJourney.feedbackSent
  ];
  const betaMissionCompleteCount = betaMissionChecks.filter(Boolean).length;
  const betaMissionPercent = Math.round((betaMissionCompleteCount / betaMissionChecks.length) * 100);
  const betaMissionComplete = betaMissionCompleteCount === betaMissionChecks.length;
  const betaNextAction =
    !betaJourney.essentialTested
      ? { kind: "essential" as const, label: tr("Commencer par Essentiel", "Start with Essential") }
      : !(betaJourney.published || draft?.status === "published")
        ? { kind: "builder" as const, label: tr("Publier le site", "Publish website") }
        : !betaJourney.essentialThenGrowth
          ? { kind: "growth-mode" as const, label: tr("Passer en Growth", "Switch to Growth") }
          : !betaJourney.growthCockpitOpened
            ? { kind: "growth" as const, label: tr("Ouvrir le cockpit Growth", "Open Growth cockpit") }
            : !betaJourney.analyticsOpened
              ? { kind: "analytics" as const, label: tr("Vérifier Analytics", "Review Analytics") }
              : !betaJourney.feedbackSent
                ? { kind: "feedback" as const, label: tr("Envoyer votre retour", "Send your feedback") }
                : { kind: "done" as const, label: tr("Mission bêta terminée", "Beta mission complete") };

  const changeBetaExperienceMode = (mode: BetaExperienceMode) => {
    setBetaExperienceMode(mode);
    writeBetaExperienceMode(mode);
    if (betaAccess.active && remoteStatus === "authenticated") {
      const eventName = mode === "growth" ? "beta_growth_selected" : "beta_essential_selected";
      void trackProductEvent(eventName, remoteSiteId).then(() =>
        getMyBetaJourneyProgress(remoteSiteId)
          .then(setBetaJourney)
          .catch(() => undefined)
      );
    }
  };

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
          <div className="builder-language-row home-hero-meta">
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
                  "Vos droits BUILD + Growth restent complets pendant toute la bêta. Commencez en mode Essentiel, puis passez en Growth pour comparer les deux expériences sans paiement ni changement d’abonnement.",
                  "Your full BUILD + Growth rights remain active throughout beta. Start in Essential mode, then switch to Growth to compare both experiences without payment or subscription changes."
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
          <BetaExperienceSwitch
            compact
            mode={betaExperienceMode}
            onChange={changeBetaExperienceMode}
          />
          <div className="beta-mission-progress" aria-label={tr("Progression de la mission bêta", "Beta mission progress")}>
            <div className="beta-mission-progress-copy">
              <span>{tr("Progression", "Progress")}</span>
              <b>{betaMissionCompleteCount}/5 · {betaMissionPercent}%</b>
            </div>
            <div className="beta-mission-progress-track" aria-hidden="true">
              <span style={{ width: `${betaMissionPercent}%` }} />
            </div>
          </div>
          <ol className="beta-mission-steps">
            <li className={betaJourney.essentialTested ? "done" : !betaJourney.essentialTested ? "next" : ""}>
              <span>{betaJourney.essentialTested ? "✓" : "1"}</span>
              <div><b>{tr("Tester Essentiel", "Test Essential")}</b><small>{tr(
                betaJourney.essentialTested
                  ? "Le parcours RUN a été commencé en mode Essentiel."
                  : "Construisez et modifiez le site avec l’expérience client Essentiel.",
                betaJourney.essentialTested
                  ? "The RUN journey has been started in Essential mode."
                  : "Build and edit the website with the Essential customer experience."
              )}</small></div>
            </li>
            <li className={betaJourney.published || draft?.status === "published" ? "done" : betaJourney.essentialTested ? "next" : ""}>
              <span>{betaJourney.published || draft?.status === "published" ? "✓" : "2"}</span>
              <div><b>{tr("Publier et contrôler", "Publish and review")}</b><small>{tr(
                betaJourney.published || draft?.status === "published"
                  ? "Une version réelle du site a été publiée."
                  : "Publiez puis vérifiez mobile, navigation, CTA et lisibilité.",
                betaJourney.published || draft?.status === "published"
                  ? "A real version of the website has been published."
                  : "Publish, then review mobile, navigation, CTA and readability."
              )}</small></div>
            </li>
            <li className={betaJourney.essentialThenGrowth ? "done" : betaJourney.published || draft?.status === "published" ? "next" : ""}>
              <span>{betaJourney.essentialThenGrowth ? "✓" : "3"}</span>
              <div><b>{tr("Comparer avec Growth", "Compare with Growth")}</b><small>{tr(
                betaJourney.essentialThenGrowth
                  ? "Growth a bien été testé après Essentiel."
                  : betaJourney.growthTested
                    ? "Growth a déjà été ouvert, mais faites aussi la séquence Essentiel → Growth pour valider la comparaison."
                    : "Passez en Growth sans paiement ni modification Stripe.",
                betaJourney.essentialThenGrowth
                  ? "Growth was tested after Essential."
                  : betaJourney.growthTested
                    ? "Growth was already opened, but also run the Essential → Growth sequence to validate the comparison."
                    : "Switch to Growth without payment or Stripe changes."
              )}</small></div>
            </li>
            <li className={betaJourney.growthExplored ? "done" : betaJourney.essentialThenGrowth ? "next" : ""}>
              <span>{betaJourney.growthExplored ? "✓" : "4"}</span>
              <div><b>{tr("Explorer Growth + Analytics", "Explore Growth + Analytics")}</b><small>{tr(
                betaJourney.growthExplored
                  ? "Le cockpit Growth et Analytics ont été réellement ouverts en mode Growth."
                  : betaJourney.growthCockpitOpened
                    ? "Cockpit Growth validé. Il reste Analytics à vérifier."
                    : betaJourney.analyticsOpened
                      ? "Analytics validé. Il reste le cockpit Growth à vérifier."
                      : "Ouvrez les deux vues pour tester le pilotage et les données de performance.",
                betaJourney.growthExplored
                  ? "The Growth cockpit and Analytics were both actually opened in Growth mode."
                  : betaJourney.growthCockpitOpened
                    ? "Growth cockpit checked. Analytics remains to be reviewed."
                    : betaJourney.analyticsOpened
                      ? "Analytics checked. The Growth cockpit remains to be reviewed."
                      : "Open both views to test management and performance data."
              )}</small></div>
            </li>
            <li className={betaJourney.feedbackSent ? "done" : betaJourney.growthExplored ? "next" : ""}>
              <span>{betaJourney.feedbackSent ? "✓" : "5"}</span>
              <div><b>{tr("Envoyer un retour", "Send feedback")}</b><small>{tr(
                betaJourney.feedbackSent
                  ? "Au moins un retour a été enregistré."
                  : "Signalez un blocage, une idée ou ce qui devrait être plus simple.",
                betaJourney.feedbackSent
                  ? "At least one feedback item has been recorded."
                  : "Report a blocker, an idea, or anything that should be simpler."
              )}</small></div>
            </li>
          </ol>
          <div className={"beta-next-action " + (betaMissionComplete ? "complete" : "")}>
            <div>
              <span>{betaMissionComplete ? tr("Mission validée", "Mission complete") : tr("Prochaine action", "Next action")}</span>
              <b>{betaNextAction.label}</b>
            </div>
            {!betaMissionComplete ? (
              betaNextAction.kind === "essential" ? (
                <button type="button" className="button primary" onClick={() => changeBetaExperienceMode("essential")}>
                  {betaNextAction.label} <span aria-hidden="true">→</span>
                </button>
              ) : betaNextAction.kind === "growth-mode" ? (
                <button type="button" className="button primary" onClick={() => changeBetaExperienceMode("growth")}>
                  {betaNextAction.label} <span aria-hidden="true">→</span>
                </button>
              ) : betaNextAction.kind === "growth" ? (
                <Link className="button primary" href="/growth">{betaNextAction.label} <span aria-hidden="true">→</span></Link>
              ) : betaNextAction.kind === "analytics" ? (
                <Link className="button primary" href="/analytics">{betaNextAction.label} <span aria-hidden="true">→</span></Link>
              ) : betaNextAction.kind === "feedback" ? (
                <Link className="button primary" href="/feedback">{betaNextAction.label} <span aria-hidden="true">→</span></Link>
              ) : (
                <Link className="button primary" href={onboardingHref}>{betaNextAction.label} <span aria-hidden="true">→</span></Link>
              )
            ) : (
              <span className="beta-mission-complete-mark">✓</span>
            )}
          </div>
                    <div className="actions beta-mission-actions">
            {betaExperienceMode === "growth" && draft?.status === "published" ? (
              <Link className="button primary" href="/growth">
                {tr("Ouvrir Growth", "Open Growth")} <span aria-hidden="true">→</span>
              </Link>
            ) : betaExperienceMode === "essential" ? (
              <button type="button" className="button primary" onClick={() => changeBetaExperienceMode("growth")}>
                {tr("Passer en Growth", "Switch to Growth")} <span aria-hidden="true">→</span>
              </button>
            ) : (
              <Link className="button primary" href={onboardingHref}>
                {tr("Publier pour tester Growth", "Publish to test Growth")} <span aria-hidden="true">→</span>
              </Link>
            )}
            <Link className="button secondary" href={onboardingHref}>
              {draft?.status === "published" ? tr("Modifier le site", "Edit website") : tr("Continuer la mission", "Continue mission")}
            </Link>
            <Link className="button secondary" href="/feedback">
              {tr("Donner mon retour", "Give feedback")}
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
                        `Votre accès ${experiencePlanName || "actuel"} permet une création BUILD complète par IA. Vous pouvez aussi tout construire manuellement.`,
                        `Your ${experiencePlanName || "current"} access includes full BUILD creation with AI. You can also build everything manually.`
                      )
                    : tr(
                        `Votre accès ${experiencePlanName || "actuel"} permet le parcours manuel. La création BUILD complète reste une option distincte si vous souhaitez accélérer la première version.`,
                        `Your ${experiencePlanName || "current"} access includes the manual path. Full BUILD creation remains a separate option if you want to accelerate the first version.`
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
                ) : betaAccess.active && betaExperienceMode === "essential" ? (
                  <button type="button" className="button secondary premium-secondary" onClick={() => changeBetaExperienceMode("growth")}>
                    {tr("Tester Growth", "Test Growth")}
                  </button>
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

      {growthExperienceAvailable ? (
        <section className="panel growth-dashboard-entry">
          <div>
            <p className="eyebrow">Growth</p>
            <h2>{tr("Votre site est publié : passez au pilotage", "Your website is live: move to management")}</h2>
            <p>{tr(
              "Le cockpit Growth regroupe les contrôles de disponibilité, SEO technique, domaine, formulaire, médias et continuité de service pour vous montrer ce qui mérite votre attention.",
              "The Growth cockpit brings together availability, technical SEO, domain, contact form, media and service continuity checks so you can see what deserves attention."
            )}</p>
          </div>
          <div className="actions">
            <Link className="button primary" href="/growth">{tr("Ouvrir le pilotage Growth", "Open Growth cockpit")} <span aria-hidden="true">→</span></Link>
            <Link className="button secondary" href="/support">{tr("Health Center", "Health Center")}</Link>
          </div>
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
