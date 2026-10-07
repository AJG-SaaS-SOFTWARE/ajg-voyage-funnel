"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useProductLocale } from "../../lib/product-i18n";
import { formatProductNumber } from "../../lib/product-format";
import { LanguageSwitch } from "../../components/LanguageSwitch";
import { EltaraBrand } from "../../components/EltaraBrand";
import { BetaExperienceSwitch } from "../../components/BetaExperienceSwitch";
import SitePreview from "../../components/SitePreview";
import MediaLibrary from "../../components/MediaLibrary";
import ContentLibraryEditor from "../../components/ContentLibraryEditor";
import ArchitectureEditor from "../../components/ArchitectureEditor";
import {
  submitArchitectQualityFeedback,
  trackProductEvent,
  type ArchitectQualityReason
} from "../../lib/product-analytics";
import ModulesEditor from "../../components/ModulesEditor";
import AiTextAssistant from "../../components/AiTextAssistant";
import ComplianceEditor from "../../components/ComplianceEditor";
import {
  defaultSiteConfig,
  requiredDisclaimer,
  type SiteConfig,
  type SiteLanguage
} from "../../lib/site-config";
import { loadDraft, publishDraft, saveDraft } from "../../lib/site-store";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../../lib/supabase-browser";
import { freeEntitlements, getMySiteAiAccess, getMySiteEntitlements, type SiteAiAccess, type SubscriptionEntitlements } from "../../lib/subscription";
import { optimizeBackgroundImage, optimizeImage } from "../../lib/optimize-image";
import { contrastRatio, surfaceInk } from "../../lib/site-design";
import { legalMissingFields } from "../../lib/site-legal";
import type { SupportDiagnosis } from "../../lib/support-diagnostics";
import { supportCheckDisplay } from "../../lib/support-guidance";
import { getPrivateBetaAccess } from "../../lib/private-beta-access";
import { readBetaExperienceMode, writeBetaExperienceMode, type BetaExperienceMode } from "../../lib/beta-experience-mode";
import { markGrowthActionPublished } from "../../lib/growth-actions";
import {
  getCurrentUser,
  getMyDomains,
  getMySite,
  getMySites,
  saveMySite,
  signOut,
  uploadProfileImage,
  uploadSiteImage,
  uploadContentAsset
} from "../../lib/supabase-site-repository";

const steps = [
  {
    key: "identity",
    label: "Identité",
    labelEn: "Identity",
    eyebrow: "Votre base",
    eyebrowEn: "Your foundation",
    description: "Nom, adresse, langue et photo : les éléments qui rendent le site immédiatement personnel.",
    descriptionEn: "Name, address, language and photo: the essentials that make the website immediately yours.",
    time: "2 min",
    guidance: "Commencez simplement par votre prénom et votre nom. Le nom du site et son adresse se préremplissent automatiquement.",
    guidanceEn: "Start with your first and last name. The website name and address are filled in automatically."
  },
  {
    key: "story",
    label: "Message",
    labelEn: "Message",
    eyebrow: "Votre voix",
    eyebrowEn: "Your voice",
    description: "Le titre, l'introduction et votre présentation. Le ton reste simple, humain et fidèle à vous.",
    descriptionEn: "Your headline, introduction and presentation. Keep the tone simple, human and true to you.",
    time: "4 min",
    guidance: "Écrivez comme si vous expliquiez votre démarche à une connaissance. Quelques phrases naturelles suffisent.",
    guidanceEn: "Write as if you were explaining what you do to someone you know. A few natural sentences are enough."
  },
  {
    key: "design",
    label: "Style",
    labelEn: "Style",
    eyebrow: "Votre ambiance",
    eyebrowEn: "Your look & feel",
    description: "Couleurs, motifs, images et sons pour donner une identité personnelle à votre site.",
    descriptionEn: "Colors, patterns, images and sound to give your website a distinctive identity.",
    time: "5 min",
    guidance: "Commencez par une couleur et un motif. Vous pouvez rechercher une image ou un son, puis revenir changer vos choix plus tard.",
    guidanceEn: "Start with a color and pattern. You can search for an image or sound and change your choices later."
  },
  {
    key: "booking",
    label: "Rendez-vous",
    labelEn: "Bookings",
    eyebrow: "Passer à l'action",
    eyebrowEn: "Drive action",
    description: "Reliez votre agenda et vos réseaux pour transformer la visite en échange concret.",
    descriptionEn: "Connect your booking page and social networks so visits can turn into real conversations.",
    time: "2 min",
    guidance: "Copiez l'adresse de votre page de réservation, puis collez-la ci-dessous. Vous pouvez aussi passer cette étape et y revenir plus tard.",
    guidanceEn: "Copy your booking page address and paste it below. You can also skip this step and return later."
  },
  {
    key: "options",
    label: "Options",
    labelEn: "Options",
    eyebrow: "Votre contenu",
    eyebrowEn: "Your content",
    description: "Configurez les rubriques facultatives, leur contenu et leur ordre d'affichage.",
    descriptionEn: "Configure optional sections, their content and display order.",
    time: "2 min",
    guidance: "Activez uniquement les rubriques utiles. Elles restent masquées tant qu'elles ne contiennent pas de contenu publiable.",
    guidanceEn: "Enable only useful sections. They stay hidden until they contain publishable content."
  },
  {
    key: "review",
    label: "Publication",
    labelEn: "Publish",
    eyebrow: "Dernière vérification",
    eyebrowEn: "Final review",
    description: "Contrôlez l'adresse, la langue et les informations essentielles avant la mise en ligne.",
    descriptionEn: "Review the address, language and essential information before going live.",
    time: "1 min",
    guidance: "Relisez le résumé. Si tout est vert, vous pouvez publier puis partager votre lien.",
    guidanceEn: "Review the summary. If everything is green, publish and share your link."
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

function VisibilityOption({
  checked,
  title,
  description,
  activeLabel,
  inactiveLabel,
  logo,
  onChange
}: {
  checked: boolean;
  title: string;
  description: string;
  activeLabel?: string;
  inactiveLabel?: string;
  logo?: string;
  onChange: (checked: boolean) => void;
}) {
  const { tr } = useProductLocale();
  const resolvedActiveLabel = activeLabel ?? tr("Actif", "Active");
  const resolvedInactiveLabel = inactiveLabel ?? tr("Masqué", "Hidden");
  return (
    <label className={`visibility-option ${checked ? "is-active" : "is-inactive"}`}>
      <input
        className="visibility-option-input"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="visibility-switch" aria-hidden="true"><i /></span>
      <span className="visibility-option-copy">
        <span className="visibility-option-heading">
          <b>{title}</b>
          <em>{checked ? resolvedActiveLabel : resolvedInactiveLabel}</em>
        </span>
        <small>{description}</small>
      </span>
      {logo ? <img className="visibility-option-logo" src={logo} alt="" aria-hidden="true" /> : null}
    </label>
  );
}

export default function BuilderPage() {
  const router = useRouter();
  const { locale, tr } = useProductLocale();
  const remoteMode = isSupabaseConfigured();

  const [config, setConfig] = useState<SiteConfig>(defaultSiteConfig);
  const [step, setStep] = useState<StepKey>("identity");
  const [saved, setSaved] = useState(false);
  const [published, setPublished] = useState(false);
  const [ready, setReady] = useState(!remoteMode);
  const [busy, setBusy] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [remoteSiteId, setRemoteSiteId] = useState<string | null>(null);
  const [ownedSites,setOwnedSites]=useState<Array<{id:string;slug:string}>>([]);
  const [siteEntitlements, setSiteEntitlements] = useState<SubscriptionEntitlements>(freeEntitlements);
  const [siteAiAccess, setSiteAiAccess] = useState<SiteAiAccess>({
    canCreateSite: false,
    canReviseSite: false,
    accessSource: "none",
    launchOperationsRemaining: 0
  });
  const [betaTester, setBetaTester] = useState(false);
  const [adminQa, setAdminQa] = useState(false);
  const [betaExperienceMode, setBetaExperienceMode] = useState<BetaExperienceMode>("essential");
  const [userEmail, setUserEmail] = useState("");
  const [origin, setOrigin] = useState("");
  const [verifiedPublicUrl, setVerifiedPublicUrl] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [postPublishHealth, setPostPublishHealth] = useState<SupportDiagnosis | null>(null);
  const [postPublishHealthState, setPostPublishHealthState] = useState<"idle" | "checking" | "done" | "error">("idle");
  const [brandTouched, setBrandTouched] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [guidedAnswers, setGuidedAnswers] = useState({
    activity: "",
    difference: "",
    goal: "",
    audience: ""
  });
  const [guidedDraftReady, setGuidedDraftReady] = useState(false);
  const [architectBrief, setArchitectBrief] = useState("");
  type ArchitectProposal = {
    heroTagline: string; heroTitle: string; heroSubtitle: string; aboutHeading: string; aboutText: string; bookingLabel: string;
    recommendedModules: string[];
    moduleOrder: string[];
    architecture: { mode: "single" | "multi"; pages: { id: string; slug: string; title: string; kind: "home" | "about" | "services" | "gallery" | "faq" | "contact" | "custom"; purpose: string; enabled: boolean; assetIds: string[] }[] };
    design: { layout: "classic" | "editorial" | "showcase" | "conversion"; heroLayout: "split" | "centered" | "immersive"; contentWidth: "compact" | "balanced" | "wide"; accent: string; background: "ivory" | "sand" | "mist" | "sage" | "slate"; pattern: "none" | "dots" | "lines" | "grid" | "rays"; patternStrength: "soft" | "bold" };
    faq: { title: string; items: { question: string; answer: string }[] };
    benefits: { title: string; items: { title: string; text: string }[] };
    intelligence: {
      readiness: "strong" | "usable" | "thin";
      understoodNeed: string;
      audience: string;
      primaryGoal: string;
      secondaryGoals: string[];
      positioning: string;
      toneKeywords: string[];
      visitorJourney: string[];
      contentPriorities: string[];
      conversionStrategy: string;
      architectureRationale: string;
      designRationale: string;
      missingInformation: string[];
      assumptions: string[];
    };
    premiumAudit: {
      reviewed: true;
      refinementApplied: boolean;
      finalReviewPerformed: boolean;
      finalVerified: boolean;
      initialScore: number;
      finalScore: number;
      issuesDetected: number;
      majorIssuesDetected: number;
      finalIssuesDetected: number;
      finalMajorIssuesDetected: number;
      deterministicChecksPerformed: true;
      deterministicIssuesDetected: number;
      deterministicBlockingIssuesDetected: number;
      strategyReused: boolean;
      strengths: string[];
      qualityNote: string;
    };
  };
  const [architectProposal, setArchitectProposal] = useState<ArchitectProposal | null>(null);
  const [architectStrategyContextKey, setArchitectStrategyContextKey] = useState("");
  const [architectClarifications, setArchitectClarifications] = useState<Record<string, string>>({});
  const [architectProposalKey, setArchitectProposalKey] = useState("");
  const [architectAttemptKind, setArchitectAttemptKind] = useState<"first" | "regeneration">("first");
  const [architectQualityChoice, setArchitectQualityChoice] = useState<"positive" | "negative" | null>(null);
  const [architectQualityReason, setArchitectQualityReason] = useState<ArchitectQualityReason | null>(null);
  const [architectQualitySubmitted, setArchitectQualitySubmitted] = useState(false);
  const [architectQualityBusy, setArchitectQualityBusy] = useState(false);
  const [architectLoading, setArchitectLoading] = useState(false);
  const [revisionRequest, setRevisionRequest] = useState("");
  const [revisionProposal, setRevisionProposal] = useState<ArchitectProposal | null>(null);
  const [revisionLoading, setRevisionLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [reviewResult, setReviewResult] = useState<{ issues: { field: keyof SiteConfig; reason: string }[]; suggestions: Record<string, string> } | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [changeVersion, setChangeVersion] = useState(0);
  const [growthActionId, setGrowthActionId] = useState("");
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const latestVersion = useRef(0);
  const trackedProductEvents = useRef(new Set<string>());

  const refreshVerifiedPublicUrl = async (siteId: string) => {
    try {
      const domains = await getMyDomains(siteId);
      const primary = domains.find(
        (domain) => domain.isPrimary && domain.verificationStatus === "verified"
      );
      setVerifiedPublicUrl(primary ? `https://${primary.hostname}` : "");
    } catch {
      setVerifiedPublicUrl("");
    }
  };

  useEffect(() => {
    if (!remoteMode || !remoteSiteId) {
      setSiteEntitlements(freeEntitlements);
      setSiteAiAccess({
        canCreateSite: false,
        canReviseSite: false,
        accessSource: "none",
        launchOperationsRemaining: 0
      });
      return;
    }
    let cancelled = false;
    void Promise.all([
      getMySiteEntitlements(remoteSiteId),
      getMySiteAiAccess(remoteSiteId)
    ])
      .then(([entitlements, aiAccess]) => {
        if (!cancelled) {
          setSiteEntitlements(entitlements);
          setSiteAiAccess(aiAccess);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSiteEntitlements(freeEntitlements);
          setSiteAiAccess({
            canCreateSite: false,
            canReviseSite: false,
            accessSource: "none",
            launchOperationsRemaining: 0
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [remoteMode, remoteSiteId]);

  const paidAiAccessActive = ["active", "trialing"].includes(siteEntitlements.status);
  const betaEssentialSimulation = betaTester && betaExperienceMode === "essential";
  const actualSiteArchitectCreateAvailable =
    paidAiAccessActive && siteAiAccess.canCreateSite;
  const actualSiteRevisionAvailable =
    paidAiAccessActive && siteAiAccess.canReviseSite;
  const siteArchitectCreateAvailable =
    actualSiteArchitectCreateAvailable && !betaEssentialSimulation;
  const siteRevisionAvailable =
    actualSiteRevisionAvailable && !betaEssentialSimulation;
  const premiumAccessHref =
    ["past_due", "canceled", "suspended"].includes(siteEntitlements.status)
      ? "/billing"
      : "/plans";
  const premiumAccessLabel =
    premiumAccessHref === "/billing" ? tr("Régulariser mon accès", "Restore my access") : tr("Voir Growth / Création IA", "View Growth / AI Launch");
  const showAdvancedDiscovery = !siteArchitectCreateAvailable || !siteRevisionAvailable;
  const growthActive = siteEntitlements.planKey === "growth" && paidAiAccessActive;
  const showGrowthRevisionWorkspace = siteRevisionAvailable && published;

  const changeBetaExperienceMode = (mode: BetaExperienceMode) => {
    setBetaExperienceMode(mode);
    writeBetaExperienceMode(mode);
    setArchitectProposal(null);
    setRevisionProposal(null);
    if (betaTester) {
      void trackProductEvent(
        mode === "growth" ? "beta_growth_selected" : "beta_essential_selected",
        remoteSiteId
      );
    }
  };

  useEffect(() => {
    if (!ready || !betaTester) return;
    void trackProductEvent(
      betaExperienceMode === "growth" ? "beta_growth_selected" : "beta_essential_selected",
      remoteSiteId
    );
  }, [ready, betaTester, betaExperienceMode, remoteSiteId]);

  useEffect(() => {
    if (!ready || !remoteMode) return;
    const eventByStep: Partial<Record<StepKey, "step_identity"|"step_story"|"step_design"|"step_booking"|"step_options"|"step_review">> = {
      identity: "step_identity",
      story: "step_story",
      design: "step_design",
      booking: "step_booking",
      options: "step_options",
      review: "step_review"
    };
    const names = ["builder_open", eventByStep[step]].filter(Boolean) as string[];
    names.forEach((name) => {
      if (trackedProductEvents.current.has(name)) return;
      trackedProductEvents.current.add(name);
      void trackProductEvent(name as any, remoteSiteId);
    });
  }, [ready, remoteMode, remoteSiteId, step]);

  useEffect(() => {
    if (!remoteMode || !ready || changeVersion === 0) return;
    const version = changeVersion;
    const timer = window.setTimeout(() => {
      saveQueue.current = saveQueue.current.catch(() => undefined).then(async () => {
        const remote = await saveMySite(config, false, remoteSiteId || undefined);
        setRemoteSiteId(remote.id);
        if (version === latestVersion.current) setSaved(true);
      }).catch((error) => setSyncError(error instanceof Error ? error.message : tr("Sauvegarde automatique impossible.", "Automatic save failed.")));
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [config, changeVersion, ready, remoteMode, remoteSiteId]);

  useEffect(() => {
    setOrigin(window.location.origin);
    let cancelled = false;

    const boot = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const requestedStep = searchParams.get("step");
      setGrowthActionId(searchParams.get("growthAction") || "");
      if (steps.some((item) => item.key === requestedStep)) {
        setStep(requestedStep as StepKey);
      }
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

        const privateBetaAccess = await getPrivateBetaAccess();
        if (!privateBetaAccess.allowed) {
          router.replace("/beta-access");
          return;
        }
        if (cancelled) return;

        setBetaTester(privateBetaAccess.betaActive);
        setAdminQa(privateBetaAccess.admin && !privateBetaAccess.betaActive);
        if (privateBetaAccess.betaActive) {
          setBetaExperienceMode(readBetaExperienceMode());
        }
        setUserEmail(user.email || "");
        const sites = await getMySites();
        setOwnedSites(sites.map(site=>({id:site.id,slug:site.slug})));
        const remote = sites[0] || null;
        if (cancelled) return;

        if (remote) {
          if (remote.privacyState === "erasure_requested") {
            router.replace("/data");
            return;
          }
          setConfig(remote.config);
          setBrandTouched(Boolean(remote.config.brandName));
          setSlugTouched(Boolean(remote.config.slug));
          setRemoteSiteId(remote.id);
          setPublished(remote.status === "published");
          await refreshVerifiedPublicUrl(remote.id);
        } else {
          setConfig(local.config);
          setBrandTouched(Boolean(local.config.brandName));
          setSlugTouched(Boolean(local.config.slug));
          setPublished(false);
        }
      } catch (error) {
        if (!cancelled) {
          setSyncError(error instanceof Error ? error.message : tr("Impossible de charger le site.", "Unable to load the website."));
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

  useEffect(() => {
    if (!ready || step !== "story") return;
    const focus = new URLSearchParams(window.location.search).get("focus");
    if (focus !== "architect") return;
    const timer = window.setTimeout(() => {
      const node =
        document.getElementById("ai-site-architect") ||
        document.getElementById("advanced-feature-discovery");
      if (node instanceof HTMLDetailsElement) node.open = true;
      node?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [ready, step, siteArchitectCreateAvailable]);

  const publicPath = "/site/" + config.slug;
  const betaPublicUrl = verifiedPublicUrl || (origin ? origin + publicPath : publicPath);

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
  const rawCurrentStep = steps[stepIndex];
  const currentStep = {
    ...rawCurrentStep,
    label: locale === "en" ? rawCurrentStep.labelEn : rawCurrentStep.label,
    eyebrow: locale === "en" ? rawCurrentStep.eyebrowEn : rawCurrentStep.eyebrow,
    description: locale === "en" ? rawCurrentStep.descriptionEn : rawCurrentStep.description,
    guidance: locale === "en" ? rawCurrentStep.guidanceEn : rawCurrentStep.guidance
  };
  const completion = Math.round(((stepIndex + 1) / steps.length) * 100);

  const update = <K extends keyof SiteConfig>(key: K, value: SiteConfig[K], preserveReview = false) => {
    setChangeVersion((version) => version + 1);
    latestVersion.current += 1;
    if (!preserveReview) setReviewResult(null);
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

  const updateAffiliation = (affiliation: SiteConfig["affiliation"]) => {
    setChangeVersion((version) => version + 1);
    latestVersion.current += 1;
    const neutralIntro = tr("Présentez votre activité, votre approche et ce que vos visiteurs peuvent découvrir avec vous.", "Present your activity, your approach and what visitors can discover with you.");
    setSaved(false);
    setPublished(false);
    setSyncError("");
    setConfig((current) => {
      const heroSubtitle = affiliation === "independent" && current.heroSubtitle === defaultSiteConfig.heroSubtitle
        ? neutralIntro
        : affiliation === "mwr" && current.heroSubtitle === neutralIntro
          ? defaultSiteConfig.heroSubtitle
          : current.heroSubtitle;
      const next = { ...current, affiliation, heroSubtitle };
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
    setChangeVersion((version) => version + 1);
    latestVersion.current += 1;
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
    stepIndex < steps.length - 1
      ? (locale === "en" ? steps[stepIndex + 1].labelEn : steps[stepIndex + 1].label)
      : "";

  const createGuidedDraft = async () => {
    const hasPersonalizedText =
      config.heroTitle !== defaultSiteConfig.heroTitle ||
      config.heroSubtitle !== defaultSiteConfig.heroSubtitle ||
      config.aboutText !== defaultSiteConfig.aboutText;
    if (hasPersonalizedText && !window.confirm(
      tr("Les textes actuels seront remplacés par la nouvelle proposition. Voulez-vous continuer ?", "The current copy will be replaced by the new proposal. Do you want to continue?")
    )) return;

    setBusy(true);
    setSyncError("");
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error(tr("L’assistant IA nécessite une connexion au site.", "The AI assistant requires a signed-in website session."));
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error(tr("Reconnectez-vous pour préparer vos textes avec l’IA.", "Sign in again to prepare your copy with AI."));

      const response = await fetch("/api/ai/write", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-AJG-Locale": locale },
        body: JSON.stringify({
          field: "guidedDraft",
          instruction: "À partir des réponses guidées, construis une première version cohérente et directement exploitable des textes du site. Transforme les notes en vraies phrases, donne un rôle distinct à chaque bloc et reste concret. Ne copie pas mécaniquement les réponses et n'invente aucun fait.",
          currentText: "",
          context: {
            language: config.language,
            affiliation: config.affiliation,
            firstName: config.firstName,
            brandName: config.brandName,
            siteContext: {
              guidedActivity: guidedAnswers.activity,
              guidedDifference: guidedAnswers.difference,
              guidedGoal: guidedAnswers.goal,
              guidedAudience: guidedAnswers.audience
            }
          }
        })
      });
      const data = await response.json();
      if (!response.ok || !data?.draft) throw new Error(data?.error || tr("Impossible de préparer les textes.", "Unable to prepare the copy."));

      const nextConfig = {
        ...config,
        heroTagline: data.draft.heroTagline.trim(),
        heroTitle: data.draft.heroTitle.trim(),
        heroSubtitle: data.draft.heroSubtitle.trim(),
        aboutHeading: data.draft.aboutHeading.trim(),
        aboutText: data.draft.aboutText.trim()
      };
      setConfig(nextConfig);
      saveDraft(nextConfig);
      setSaved(false);
      setPublished(false);
      setGuidedDraftReady(true);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : tr("Impossible de préparer les textes.", "Unable to prepare the copy."));
    } finally {
      setBusy(false);
    }
  };

  const createSiteWithAi = async (extraBrief = "") => {
    if (!siteArchitectCreateAvailable) {
      router.push(premiumAccessHref);
      return;
    }
    if (!architectBrief.trim()) return;
    const briefForRequest = [architectBrief.trim(), extraBrief.trim()]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 7000);
    const isRegeneration = architectProposal !== null;
    const strategyContextKey = JSON.stringify({
      brief: briefForRequest,
      language: config.language,
      affiliation: config.affiliation,
      firstName: config.firstName.trim(),
      brandName: config.brandName.trim(),
      siteContext: aiSiteContext,
      contentLibrary: config.contentLibrary.assets.map((asset) => ({
        id: asset.id,
        kind: asset.kind,
        name: asset.name,
        text: asset.kind === "text" ? asset.text : "",
        rights: asset.rights,
        publishable: asset.publishable,
        sourceUrl: asset.sourceUrl,
        notes: asset.notes
      }))
    });
    const canReuseStrategy =
      isRegeneration &&
      !extraBrief.trim() &&
      architectStrategyContextKey === strategyContextKey &&
      Boolean(architectProposal?.intelligence);
    setArchitectLoading(true);
    setSyncError("");
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error(tr("La création complète par IA nécessite une connexion.", "Full AI website creation requires a signed-in session."));
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) throw new Error(tr("Reconnectez-vous pour utiliser la création complète par IA.", "Sign in again to use full AI website creation."));
      const architectSiteId = remoteSiteId || (await saveMySite(config, false)).id;
      if (!remoteSiteId) setRemoteSiteId(architectSiteId);
      const response = await fetch("/api/ai/write", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}`, "X-AJG-Locale": locale },
        body: JSON.stringify({
          field: "siteArchitect",
          siteId: architectSiteId,
          instruction: "Construis une première proposition cohérente de site à partir du besoin décrit. N'invente aucune information absente. Utilise en priorité les contenus utilisateur publiables dont les droits sont connus et ne recommande jamais pour publication un média aux droits inconnus.",
          context: {
            language: config.language,
            affiliation: config.affiliation,
            firstName: config.firstName,
            brandName: config.brandName,
            architectBrief: briefForRequest,
            reuseStrategy: canReuseStrategy,
            existingStrategy: canReuseStrategy ? architectProposal?.intelligence : null,
            variationReference: canReuseStrategy && architectProposal
              ? {
                  heroTagline: architectProposal.heroTagline,
                  heroTitle: architectProposal.heroTitle,
                  heroSubtitle: architectProposal.heroSubtitle,
                  bookingLabel: architectProposal.bookingLabel,
                  recommendedModules: architectProposal.recommendedModules,
                  architecture: architectProposal.architecture,
                  design: architectProposal.design
                }
              : null,
            contentLibrary: config.contentLibrary.assets.map((asset) => ({
              id: asset.id,
              kind: asset.kind,
              name: asset.name,
              text: asset.kind === "text" ? asset.text : "",
              rights: asset.rights,
              publishable: asset.publishable,
              sourceUrl: asset.sourceUrl,
              notes: asset.notes
            })),
            siteContext: aiSiteContext
          }
        })
      });
      const result = await response.json();
      if (response.ok && architectSiteId) {
        void getMySiteAiAccess(architectSiteId)
          .then(setSiteAiAccess)
          .catch(() => undefined);
      }
      if (!response.ok || !result?.proposal) throw new Error(result?.error || tr("Impossible de préparer le site complet.", "Unable to prepare the complete website."));
      setArchitectProposal(result.proposal);
      setArchitectStrategyContextKey(strategyContextKey);
      setArchitectProposalKey(crypto.randomUUID());
      setArchitectAttemptKind(isRegeneration ? "regeneration" : "first");
      setArchitectQualityChoice(null);
      setArchitectQualityReason(null);
      setArchitectQualitySubmitted(false);
      if (extraBrief.trim()) {
        setArchitectBrief(briefForRequest.slice(0, 4000));
        setArchitectClarifications({});
      }
      void trackProductEvent(isRegeneration ? "architect_regenerated" : "architect_generated", architectSiteId);
      if (result.proposal?.premiumAudit?.refinementApplied === true) {
        void trackProductEvent("architect_refined", architectSiteId);
      }
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : tr("Impossible de préparer le site complet.", "Unable to prepare the complete website."));
    } finally {
      setArchitectLoading(false);
    }
  };

  const submitArchitectRating = async (
    verdict: "positive" | "negative",
    reason?: ArchitectQualityReason | null
  ) => {
    if (
      !architectProposal ||
      !architectProposalKey ||
      !remoteSiteId ||
      architectQualitySubmitted
    ) return;

    setArchitectQualityBusy(true);
    setSyncError("");
    try {
      await submitArchitectQualityFeedback({
        proposalKey: architectProposalKey,
        siteId: remoteSiteId,
        verdict,
        reason: reason || null,
        attemptKind: architectAttemptKind,
        auditScore:
          architectProposal.premiumAudit.finalScore ||
          architectProposal.premiumAudit.initialScore,
        refinementApplied: architectProposal.premiumAudit.refinementApplied
      });
      setArchitectQualityChoice(verdict);
      setArchitectQualityReason(reason || null);
      setArchitectQualitySubmitted(true);
    } catch (error) {
      setSyncError(
        error instanceof Error
          ? error.message
          : tr("Votre évaluation n’a pas pu être enregistrée.", "Your feedback could not be recorded.")
      );
    } finally {
      setArchitectQualityBusy(false);
    }
  };

  const improveArchitectWithClarifications = async () => {
    if (!architectProposal?.intelligence.missingInformation.length) return;
    const answered = architectProposal.intelligence.missingInformation
      .map((question) => ({
        question,
        answer: (architectClarifications[question] || "").trim()
      }))
      .filter((item) => item.answer);

    if (!answered.length) return;

    const extraBrief = [
      "Informations complémentaires fournies après l'analyse du premier brief :",
      ...answered.map((item) => `- ${item.question}\n  Réponse : ${item.answer}`)
    ].join("\n");

    await createSiteWithAi(extraBrief);
  };

  const requestGlobalRevision = async () => {
    if (!siteRevisionAvailable) {
      router.push(premiumAccessHref);
      return;
    }
    if (!revisionRequest.trim()) return;
    setRevisionLoading(true);
    setSyncError("");
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error(tr("La révision globale nécessite une connexion.", "Full-site revision requires a signed-in session."));
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) throw new Error(tr("Reconnectez-vous pour utiliser la révision globale.", "Sign in again to use full-site revision."));
      const revisionSiteId = remoteSiteId || (await saveMySite(config, false)).id;
      if (!remoteSiteId) setRemoteSiteId(revisionSiteId);
      const existingProposal = {
        heroTagline: config.heroTagline, heroTitle: config.heroTitle, heroSubtitle: config.heroSubtitle, aboutHeading: config.aboutHeading, aboutText: config.aboutText, bookingLabel: config.bookingLabel,
        architecture: config.architecture,
        design: { layout: config.design.layout, heroLayout: config.design.heroLayout, contentWidth: config.design.contentWidth, accent: config.design.accent, background: config.design.background, pattern: config.design.pattern, patternStrength: config.design.patternStrength },
        recommendedModules: config.design.modules.order.filter((key) => config.design.modules[key]?.enabled),
        faq: config.design.modules.faq,
        benefits: config.design.modules.benefits
      };
      const response = await fetch("/api/ai/write", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}`, "X-AJG-Locale": locale }, body: JSON.stringify({
        field: "siteRevision", siteId: revisionSiteId, instruction: revisionRequest,
        context: { language: config.language, affiliation: config.affiliation, firstName: config.firstName, brandName: config.brandName, revisionRequest, existingProposal, contentLibrary: config.contentLibrary.assets.map((asset) => ({ id: asset.id, kind: asset.kind, name: asset.name, rights: asset.rights, publishable: asset.publishable, notes: asset.notes })), siteContext: aiSiteContext }
      }) });
      const result = await response.json();
      if (!response.ok || !result?.proposal) throw new Error(result?.error || tr("Impossible de préparer cette révision.", "Unable to prepare this revision."));
      setRevisionProposal(result.proposal);
    } catch (error) { setSyncError(error instanceof Error ? error.message : tr("Impossible de préparer cette révision.", "Unable to prepare this revision.")); }
    finally { setRevisionLoading(false); }
  };

  const applyArchitectProposal = (proposal: ArchitectProposal | null = architectProposal) => {
    if (!proposal) return;
    const recommended = new Set<string>(proposal.recommendedModules || []);
    const modules = config.design.modules;
    const next: SiteConfig = {
      ...config,
      heroTagline: proposal.heroTagline || config.heroTagline,
      heroTitle: proposal.heroTitle || config.heroTitle,
      heroSubtitle: proposal.heroSubtitle || config.heroSubtitle,
      aboutHeading: proposal.aboutHeading || config.aboutHeading,
      aboutText: proposal.aboutText || config.aboutText,
      bookingLabel: proposal.bookingLabel || config.bookingLabel,
      architecture: proposal.architecture || config.architecture,
      design: {
        ...config.design,
        layout: proposal.design?.layout || config.design.layout,
        heroLayout: proposal.design?.heroLayout || config.design.heroLayout,
        contentWidth: proposal.design?.contentWidth || config.design.contentWidth,
        accent: proposal.design?.accent || config.design.accent,
        background: proposal.design?.background || config.design.background,
        pattern: proposal.design?.pattern || config.design.pattern,
        patternStrength: proposal.design?.patternStrength || config.design.patternStrength,
        customBackgroundColor: "",
        modules: {
          ...modules,
          order: proposal.moduleOrder?.length
            ? [...new Set([...proposal.moduleOrder, ...modules.order])] as typeof modules.order
            : modules.order,
          gallery: { ...modules.gallery, enabled: recommended.has("gallery") && modules.gallery.images.length > 0 },
          faq: { ...modules.faq, enabled: recommended.has("faq") && proposal.faq?.items?.length > 0, title: proposal.faq?.title || modules.faq.title, items: proposal.faq?.items || modules.faq.items },
          testimonials: { ...modules.testimonials, enabled: recommended.has("testimonials") && modules.testimonials.items.length > 0 },
          contact: { ...modules.contact, enabled: recommended.has("contact") && Boolean(modules.contact.email.trim()) },
          video: { ...modules.video, enabled: recommended.has("video") && Boolean(modules.video.url.trim()) },
          figures: { ...modules.figures, enabled: recommended.has("figures") && modules.figures.items.some((item) => item.value.trim() && item.label.trim()) },
          benefits: { ...modules.benefits, enabled: recommended.has("benefits") && proposal.benefits?.items?.length > 0, title: proposal.benefits?.title || modules.benefits.title, items: proposal.benefits?.items || modules.benefits.items }
        }
      }
    };
    setConfig(next);
    saveDraft(next);
    setSaved(false);
    setPublished(false);
    setArchitectProposal(null);
    setRevisionProposal(null);
    setRevisionRequest("");
    setChangeVersion((version) => version + 1);
    latestVersion.current += 1;
    setReviewResult(null);
    setStep("review");
    void trackProductEvent(revisionProposal ? "revision_applied" : "architect_applied", remoteSiteId);
  };

  const guidedDraftEnabled =
    guidedAnswers.activity.trim().length > 0 &&
    guidedAnswers.difference.trim().length > 0 &&
    guidedAnswers.goal.trim().length > 0;

  const aiSiteContext = {
    heroTagline: config.heroTagline,
    heroTitle: config.heroTitle,
    heroSubtitle: config.heroSubtitle,
    aboutHeading: config.aboutHeading,
    aboutText: config.aboutText,
    guidedActivity: guidedAnswers.activity,
    guidedDifference: guidedAnswers.difference,
    guidedGoal: guidedAnswers.goal,
    guidedAudience: guidedAnswers.audience
  };

  const architectBriefLength = architectBrief.trim().length;
  const architectBriefReady = architectBriefLength >= 80;

  const revisionChangeSummary = useMemo(() => {
    if (!revisionProposal) return [] as string[];

    const changes: string[] = [];
    const same = (left: unknown, right: unknown) =>
      JSON.stringify(left) === JSON.stringify(right);

    if (
      revisionProposal.heroTagline !== config.heroTagline ||
      revisionProposal.heroTitle !== config.heroTitle ||
      revisionProposal.heroSubtitle !== config.heroSubtitle
    ) {
      changes.push("Accueil");
    }

    if (
      revisionProposal.aboutHeading !== config.aboutHeading ||
      revisionProposal.aboutText !== config.aboutText
    ) {
      changes.push(tr("Présentation", "Presentation"));
    }

    if (revisionProposal.bookingLabel !== config.bookingLabel) {
      changes.push(tr("Bouton de rendez-vous", "Booking button"));
    }

    if (!same(revisionProposal.architecture, config.architecture)) {
      changes.push("Architecture / pages");
    }

    if (
      !same(
        revisionProposal.design,
        {
          layout: config.design.layout,
          heroLayout: config.design.heroLayout,
          contentWidth: config.design.contentWidth,
          accent: config.design.accent,
          background: config.design.background,
          pattern: config.design.pattern,
          patternStrength: config.design.patternStrength
        }
      )
    ) {
      changes.push("Direction visuelle");
    }

    const currentEnabledModules = config.design.modules.order.filter(
      (key) => config.design.modules[key]?.enabled
    );
    if (
      !same(
        [...revisionProposal.recommendedModules].sort(),
        [...currentEnabledModules].sort()
      ) ||
      !same(revisionProposal.moduleOrder, config.design.modules.order)
    ) {
      changes.push(tr("Rubriques", "Sections"));
    }

    if (
      !same(revisionProposal.faq, {
        title: config.design.modules.faq.title,
        items: config.design.modules.faq.items
      })
    ) {
      changes.push("FAQ");
    }

    if (
      !same(revisionProposal.benefits, {
        title: config.design.modules.benefits.title,
        items: config.design.modules.benefits.items
      })
    ) {
      changes.push("Avantages");
    }

    return changes;
  }, [revisionProposal, config]);

  const bookingLinkStatus = (() => {
    const value = config.bookingUrl.trim();
    if (!value) return "empty";
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.hostname.includes(".")
        ? "valid"
        : "invalid";
    } catch {
      return "invalid";
    }
  })();

  const qualityChecks = useMemo(() => {
    const checks: { label: string; detail: string; status: "pass" | "warn"; step: StepKey }[] = [];
    const words = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;
    const validOptionalUrl = (value: string) => {
      if (!value.trim()) return true;
      try { const url = new URL(value); return url.protocol === "https:" && url.hostname.includes("."); } catch { return false; }
    };
    checks.push({ label: tr("Identité complète", "Complete identity"), detail: config.firstName.trim() && config.lastName.trim() && config.brandName.trim() ? tr("Nom et identité du site renseignés.", "Website name and identity are filled in.") : tr("Complétez l’identité du site.", "Complete the website identity."), status: config.firstName.trim() && config.lastName.trim() && config.brandName.trim() ? "pass" : "warn", step: "identity" });
    checks.push({ label: tr("Message d’accueil", "Homepage message"), detail: config.heroTitle.trim() && words(config.heroSubtitle) >= 6 ? tr("Titre et introduction suffisamment renseignés.", "Headline and introduction are sufficiently complete.") : tr("Ajoutez un titre et une introduction plus complète.", "Add a headline and a fuller introduction."), status: config.heroTitle.trim() && words(config.heroSubtitle) >= 6 ? "pass" : "warn", step: "story" });
    checks.push({ label: tr("Présentation personnelle", "Personal presentation"), detail: words(config.aboutText) >= 25 ? tr("La présentation apporte assez de contexte.", "The presentation provides enough context.") : tr("La présentation gagnerait à être un peu plus développée.", "The presentation would benefit from a little more detail."), status: words(config.aboutText) >= 25 ? "pass" : "warn", step: "story" });
    const bookingLabelLength = config.bookingLabel.trim().length;
    const ctaOk = !config.design.showBooking || !config.bookingUrl.trim() || (bookingLabelLength >= 3 && bookingLabelLength <= 60);
    checks.push({ label: tr("Appel à l’action", "Call to action"), detail: ctaOk ? tr("Le rendez-vous et le libellé du bouton sont cohérents.", "The booking link and button label are consistent.") : tr("Utilisez un libellé de bouton clair et concis, entre 3 et 60 caractères.", "Use a clear, concise button label between 3 and 60 characters."), status: ctaOk ? "pass" : "warn", step: "booking" });
    const socialOk = (!config.design.showInstagram || validOptionalUrl(config.instagramUrl)) && (!config.design.showFacebook || validOptionalUrl(config.facebookUrl));
    checks.push({ label: tr("Liens externes", "External links"), detail: socialOk && (!config.design.showBooking || bookingLinkStatus !== "invalid") ? tr("Les liens affichés ont un format valide.", "Displayed links use a valid format.") : tr("Au moins un lien affiché doit être vérifié.", "At least one displayed link needs checking."), status: socialOk && (!config.design.showBooking || bookingLinkStatus !== "invalid") ? "pass" : "warn", step: "booking" });
    const mediaOk = Boolean(config.profileImageUrl || config.design.heroImage || config.design.backgroundPhotoUrl);
    checks.push({ label: tr("Qualité visuelle", "Visual quality"), detail: mediaOk ? tr("Au moins un visuel personnel ou principal est présent.", "At least one personal or primary visual is present.") : tr("Ajoutez une photo ou une image principale pour renforcer l’impact visuel.", "Add a photo or main image to strengthen the visual impact."), status: mediaOk ? "pass" : "warn", step: "design" });
    const portraitOk = !config.design.showPortrait || Boolean(config.profileImageUrl);
    checks.push({ label: tr("Photo de profil", "Profile photo"), detail: portraitOk ? (config.design.showPortrait ? tr("Le portrait affiché dispose d’une photo.", "The displayed portrait has a photo.") : tr("Le portrait est volontairement masqué.", "The portrait is intentionally hidden.")) : tr("Le portrait est activé sans photo : les initiales seront affichées. Ajoutez une photo ou masquez le portrait.", "The portrait is enabled without a photo: initials will be displayed. Add a photo or hide the portrait."), status: portraitOk ? "pass" : "warn", step: "identity" });
    checks.push({ label: tr("Conformité activité", "Activity compliance"), detail: config.affiliation === "mwr" ? tr("La mention d’indépendance obligatoire sera affichée.", "The required independence disclosure will be displayed.") : tr("Le profil d’activité indépendant est appliqué.", "The independent activity profile is applied."), status: "pass", step: "options" });
    const legalMissing = legalMissingFields(config.legal, config.firstName, config.lastName);
    checks.push({
      label: tr("Mentions légales & RGPD", "Legal notice & GDPR"),
      detail: legalMissing.length ? `${tr("À compléter :", "To complete:")} ${legalMissing.slice(0, 4).join(", ")}${legalMissing.length > 4 ? "…" : ""}` : tr("Les informations nécessaires aux pages Mentions légales, Confidentialité et Cookies sont renseignées.", "The information required for the Legal notice, Privacy and Cookies pages is complete."),
      status: legalMissing.length ? "warn" : "pass",
      step: "options"
    });
    const { surface, ink } = surfaceInk(config.design);
    checks.push({ label: tr("Lisibilité des rubriques", "Section readability"), detail: `${tr("Contraste du fond et du texte :", "Background/text contrast:")} ${formatProductNumber(contrastRatio(surface, ink), locale, 1, 1)}:1.`, status: contrastRatio(surface, ink) >= 4.5 ? "pass" : "warn", step: "design" });
    checks.push({ label: tr("Contraste du bouton", "Button contrast"), detail: `${tr("Texte du bouton adapté à la couleur choisie", "Button text adapted to the selected color")} (${formatProductNumber(contrastRatio(config.design.accent, surfaceInk({ ...config.design, customBackgroundColor: config.design.accent }).ink), locale, 1, 1)}:1).`, status: "pass", step: "design" });
    const allText = [config.heroTagline, config.heroTitle, config.heroSubtitle, config.aboutHeading, config.aboutText].filter((value) => value.trim());
    const normalized = allText.map((value) => value.trim().toLowerCase().replace(/[.!?]+$/, ""));
    checks.push({ label: tr("Répétitions évidentes", "Obvious repetition"), detail: new Set(normalized).size === normalized.length ? tr("Aucun texte identique entre les champs principaux.", "No identical copy appears across the main fields.") : tr("Deux champs contiennent le même texte : diversifiez-les.", "Two fields contain the same text: make them more distinct."), status: new Set(normalized).size === normalized.length ? "pass" : "warn", step: "story" });
    const placeholders = /lorem ipsum|votre texte ici|exemple de texte|texte à compléter|your text here|sample text|text to complete/i.test(allText.join(" "));
    checks.push({ label: tr("Texte à compléter", "Placeholder copy"), detail: placeholders ? tr("Un texte de démonstration semble encore présent.", "Demo or placeholder copy still appears to be present.") : tr("Aucun texte de démonstration connu détecté.", "No known placeholder copy detected."), status: placeholders ? "warn" : "pass", step: "story" });
    const responsiveTextOk = config.heroTitle.trim().length <= 90
      && config.heroSubtitle.trim().length <= 320
      && config.brandName.trim().length <= 70
      && (!config.design.showBooking || config.bookingLabel.trim().length <= 60);
    checks.push({ label: tr("Responsive du contenu", "Responsive content"), detail: responsiveTextOk ? tr("Les longueurs principales restent adaptées aux petits écrans.", "Main text lengths remain suitable for small screens.") : tr("Un titre, une introduction, le nom du site ou le CTA est trop long pour un affichage mobile confortable.", "A title, introduction, website name or CTA is too long for comfortable mobile display."), status: responsiveTextOk ? "pass" : "warn", step: "story" });
    const focusOk = !config.design.backgroundPhotoUrl
      || (config.design.backgroundPositionX >= 10 && config.design.backgroundPositionX <= 90 && config.design.backgroundPositionY >= 10 && config.design.backgroundPositionY <= 85);
    checks.push({ label: tr("Cadrage mobile", "Mobile cropping"), detail: focusOk ? tr("Le point focal de la photo reste dans une zone sûre pour le recadrage cover.", "The photo focal point remains in a safe area for cover cropping.") : tr("Le point focal est très proche d’un bord : vérifiez le rendu sur mobile.", "The focal point is very close to an edge: check the mobile result."), status: focusOk ? "pass" : "warn", step: "design" });
    const unknownRights = config.contentLibrary.assets.filter((asset) => asset.rights === "unknown");
    const publishableMissing = config.contentLibrary.assets.filter((asset) => asset.publishable && ((asset.kind !== "text" && (!asset.url || asset.url.startsWith("private://"))) || (asset.kind === "text" && !asset.text.trim())));
    const rightsSourceMissing = config.contentLibrary.assets.filter((asset) => (asset.rights === "licensed" || asset.rights === "public-domain") && !asset.sourceUrl.trim());
    checks.push({ label: tr("Droits des contenus", "Content rights"), detail: unknownRights.length ? `${unknownRights.length} ${tr("contenu(s) ont des droits à vérifier et restent exclus de la publication.", "item(s) have rights that still need verification and remain excluded from publishing.")}` : rightsSourceMissing.length ? `${rightsSourceMissing.length} ${tr("contenu(s) sous licence ou domaine public nécessitent encore une source vérifiable.", "licensed or public-domain item(s) still need a verifiable source.")}` : tr("Les contenus fournis ont un statut de droits explicite et les sources requises.", "Provided content has an explicit rights status and the required sources."), status: unknownRights.length || rightsSourceMissing.length ? "warn" : "pass", step: "story" });
    checks.push({ label: tr("Bibliothèque de contenus", "Content library"), detail: publishableMissing.length ? tr("Un contenu autorisé à la publication ne possède pas encore de fichier exploitable.", "Content authorized for publication is still missing a usable file.") : tr("Les contenus publiables disposent des informations nécessaires.", "Publishable content has the required information."), status: publishableMissing.length ? "warn" : "pass", step: "story" });
    const enabledPages = config.architecture.pages.filter((page) => page.enabled);
    const pageSlugs = enabledPages.map((page) => page.slug);
    const clearedAssetIds = new Set(config.contentLibrary.assets.filter((asset) => asset.publishable && asset.rights !== "unknown").map((asset) => asset.id));
    const invalidAssignments = enabledPages.flatMap((page) => page.assetIds || []).filter((id) => !clearedAssetIds.has(id));
    const architectureOk = enabledPages.some((page) => page.kind === "home") && new Set(pageSlugs).size === pageSlugs.length && (config.architecture.mode === "single" || enabledPages.length > 1);
    checks.push({ label: tr("Affectation des contenus", "Content assignment"), detail: invalidAssignments.length ? tr("Une page référence un contenu non autorisé ou aux droits non validés.", "A page references content that is not authorized or whose rights are not validated.") : tr("Les contenus affectés aux pages sont autorisés à la publication.", "Content assigned to pages is authorized for publication."), status: invalidAssignments.length ? "warn" : "pass", step: "story" });
    checks.push({ label: tr("Architecture du site", "Website architecture"), detail: architectureOk ? `${enabledPages.length} ${tr("page(s), hiérarchie et URLs cohérentes.", "page(s), hierarchy and URLs are consistent.")}` : tr("La structure des pages contient une incohérence à corriger.", "The page structure contains an inconsistency that needs correction."), status: architectureOk ? "pass" : "warn", step: "story" });
    const modules = config.design.modules;
    const validYoutubeUrl = (value: string) => {
      try {
        const url = new URL(value);
        if (url.protocol !== "https:") return false;
        if (url.hostname === "youtu.be") return /^[\w-]{11}$/.test(url.pathname.slice(1));
        if (!["youtube.com", "www.youtube.com"].includes(url.hostname)) return false;
        const id = url.searchParams.get("v") || url.pathname.match(/^\/embed\/([\w-]{11})$/)?.[1];
        return Boolean(id && /^[\w-]{11}$/.test(id));
      } catch {
        return false;
      }
    };
    const moduleProblems: string[] = [];
    if (modules.gallery.enabled && modules.gallery.images.length === 0) moduleProblems.push(tr("galerie", "gallery"));
    if (modules.faq.enabled && !modules.faq.items.some((item) => item.question.trim() && item.answer.trim())) moduleProblems.push("FAQ");
    if (modules.testimonials.enabled && !modules.testimonials.items.some((item) => item.quote.trim() && item.author.trim())) moduleProblems.push(tr("témoignages", "testimonials"));
    if (modules.contact.enabled && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(modules.contact.email)) moduleProblems.push(tr("contact", "contact"));
    if (modules.video.enabled && !validYoutubeUrl(modules.video.url)) moduleProblems.push(tr("vidéo", "video"));
    if (modules.figures.enabled && !modules.figures.items.some((item) => item.value.trim() && item.label.trim())) moduleProblems.push(tr("chiffres clés", "key figures"));
    if (modules.benefits.enabled && !modules.benefits.items.some((item) => item.title.trim() && item.text.trim())) moduleProblems.push(tr("avantages", "benefits"));
    const moduleReady = moduleProblems.length === 0;
    checks.push({ label: tr("Modules activés", "Enabled sections"), detail: moduleReady ? tr("Les rubriques activées ont du contenu publiable.", "Enabled sections contain publishable content.") : `${tr("À compléter :", "To complete:")} ${moduleProblems.join(", ")}.`, status: moduleReady ? "pass" : "warn", step: "options" });
    const galleryAccessible = !modules.gallery.enabled || modules.gallery.images.length === 0 || modules.gallery.images.every((image) => image.caption.trim().length >= 3);
    checks.push({ label: tr("Images accessibles", "Accessible images"), detail: galleryAccessible ? tr("Les images de galerie ont une légende exploitable comme description.", "Gallery images have captions that can be used as descriptions.") : tr("Ajoutez une légende descriptive aux images de galerie pour améliorer compréhension et accessibilité.", "Add descriptive captions to gallery images to improve clarity and accessibility."), status: galleryAccessible ? "pass" : "warn", step: "options" });
    const sentences = [config.heroSubtitle, config.aboutText].filter(Boolean);
    const punctuation = sentences.every((text) => /[.!?…]$/.test(text.trim()));
    checks.push({ label: tr("Ponctuation", "Punctuation"), detail: punctuation ? tr("Les paragraphes principaux se terminent correctement.", "The main paragraphs end correctly.") : tr("Vérifiez la ponctuation de l’introduction et de la présentation.", "Check punctuation in the introduction and presentation."), status: punctuation ? "pass" : "warn", step: "story" });
    const editorialReviewOk = reviewResult !== null && reviewResult.issues.length === 0;
    checks.push({
      label: tr("Relecture éditoriale IA", "AI editorial review"),
      detail: reviewResult === null
        ? tr("La relecture orthographe, grammaire et cohérence n’a pas encore été lancée.", "Spelling, grammar and consistency review has not been run yet.")
        : reviewResult.issues.length
          ? `${reviewResult.issues.length} ${tr("suggestion(s) restent à examiner avant publication.", "suggestion(s) remain to review before publishing.")}`
          : tr("Orthographe, grammaire, cohérence et clarté ont été relues sans correction restante.", "Spelling, grammar, consistency and clarity were reviewed with no remaining corrections."),
      status: editorialReviewOk ? "pass" : "warn",
      step: "review"
    });
    return checks;
  }, [config, bookingLinkStatus, reviewResult, tr]);

  const qualityPassed = qualityChecks.filter((check) => check.status === "pass").length;
  const qualityWarnings = qualityChecks.length - qualityPassed;
  const reviewFieldLabels: Partial<Record<keyof SiteConfig, string>> = {
    heroTagline: tr("Accroche", "Tagline"),
    heroTitle: tr("Titre principal", "Main headline"),
    heroSubtitle: tr("Introduction", "Introduction"),
    aboutHeading: tr("Titre de présentation", "About heading"),
    aboutText: tr("Présentation", "About text"),
    bookingLabel: tr("Bouton de rendez-vous", "Booking button")
  };
  const currentReviewText = (field: keyof SiteConfig) => {
    const value = config[field];
    return typeof value === "string" ? value : "";
  };

  const errors = useMemo(() => {
    const next: { message: string; step: StepKey }[] = [];
    if (!config.firstName.trim()) next.push({ message: tr("Prénom manquant", "First name missing"), step: "identity" });
    if (!config.lastName.trim()) next.push({ message: tr("Nom manquant", "Last name missing"), step: "identity" });
    if (!config.brandName.trim()) next.push({ message: tr("Nom du site manquant", "Website name missing"), step: "identity" });
    if (!config.slug.trim()) next.push({ message: tr("Adresse du site manquante", "Website address missing"), step: "identity" });
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(config.slug)) next.push({ message: tr("Adresse du site invalide", "Invalid website address"), step: "identity" });
    if (!config.heroTitle.trim()) next.push({ message: tr("Titre principal manquant", "Main headline missing"), step: "story" });
    if (config.design.showBooking && bookingLinkStatus === "invalid") {
      next.push({ message: tr("Lien de rendez-vous invalide", "Invalid booking link"), step: "booking" });
    }
    if (config.affiliation === "independent" && /\b(mwr\s*life|travel\s*advantage)\b/i.test([config.heroTitle, config.heroSubtitle, config.aboutText, config.brandName, JSON.stringify(config.design.modules)].join(" "))) {
      next.push({ message: tr("Les textes citent MWR Life ou Travel Advantage : choisissez l’activité correspondante ou retirez ces références", "The copy mentions MWR Life or Travel Advantage: choose the matching activity or remove those references"), step: "options" });
    }
    const missingLegal = legalMissingFields(config.legal, config.firstName, config.lastName);
    if (missingLegal.length) {
      next.push({ message: `${tr("Informations légales à compléter :", "Legal information to complete:")} ${missingLegal.slice(0, 3).join(", ")}${missingLegal.length > 3 ? "…" : ""}`, step: "options" });
    }
    return next;
  }, [config, bookingLinkStatus, tr]);

  const runPostPublishHealth = async (siteId: string, accessToken: string) => {
    setPostPublishHealthState("checking");
    setPostPublishHealth(null);
    try {
      const response = await fetch(
        `/api/support/health?siteId=${encodeURIComponent(siteId)}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store"
        }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.health?.diagnosis) {
        throw new Error(body?.error || "health_unavailable");
      }
      setPostPublishHealth(body.health.diagnosis as SupportDiagnosis);
      setPostPublishHealthState("done");
    } catch {
      setPostPublishHealthState("error");
    }
  };

  const save = async () => {
    setBusy(true);
    setSyncError("");
    try {
      await saveQueue.current;
      saveDraft(config);
      if (remoteMode) {
        const remote = await saveMySite(config, false, remoteSiteId || undefined);
        setRemoteSiteId(remote.id);
      }
      setSaved(true);
      setPublished(false);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : tr("La sauvegarde n’a pas abouti. Vérifiez votre connexion puis réessayez ; vos modifications restent affichées dans ELTARA.", "Saving did not complete. Check your connection and try again; your changes remain visible in ELTARA."));
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (errors.length) return;
    setBusy(true);
    setSyncError("");
    try {
      await saveQueue.current;
      let publishedSiteId = remoteSiteId;
      let publishConfig = config;
      let publishAccessToken = "";
      if (remoteMode) {
        const supabase = getSupabaseBrowserClient();
        const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
        if (!data.session?.access_token) throw new Error(tr("Reconnectez-vous pour publier.", "Sign in again to publish."));
        publishAccessToken = data.session.access_token;
        const site = remoteSiteId ? { id: remoteSiteId } : await saveMySite(config, false, remoteSiteId || undefined);
        publishedSiteId = site.id;
        setRemoteSiteId(site.id);
        const promotedAssets = await Promise.all(config.contentLibrary.assets.map(async (asset) => {
          if (!asset.publishable || asset.kind === "text" || !asset.url.startsWith("private://")) return asset;
          const response = await fetch("/api/media/promote", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}`, "X-AJG-Locale": locale },
            body: JSON.stringify({ siteId: site.id, privateRef: asset.url, assetId: asset.id, rights: asset.rights, sourceUrl: asset.sourceUrl })
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || tr("Impossible de préparer un média pour la publication.", "Unable to prepare media for publishing."));
          return { ...asset, url: result.url };
        }));
        publishConfig = { ...config, contentLibrary: { assets: promotedAssets } };
        const remote = await saveMySite(publishConfig, true, publishedSiteId || undefined);
        publishedSiteId = remote.id;
        if (growthActionId && remote.publishedAt) {
          await markGrowthActionPublished(growthActionId, remote.id, remote.publishedAt);
          setGrowthActionId("");
        }
        setRemoteSiteId(remote.id);
        setConfig(publishConfig);
        await refreshVerifiedPublicUrl(remote.id);
      }
      publishDraft(publishConfig);
      setSaved(true);
      setPublished(true);
      void trackProductEvent("publish_success", publishedSiteId);
      if (remoteMode && publishedSiteId && publishAccessToken) {
        void runPostPublishHealth(publishedSiteId, publishAccessToken);
      }
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : tr("La publication n’a pas abouti. Relancez la publication ; si le problème persiste, ouvrez le Health Center sans recréer le site.", "Publishing did not complete. Try publishing again; if the issue persists, open the Health Center without recreating the website."));
    } finally {
      setBusy(false);
    }
  };

  const reviewWithAi = async () => {
    setReviewing(true);
    setSyncError("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      if (!data.session?.access_token) throw new Error(tr("Reconnectez-vous pour lancer la relecture IA.", "Sign in again to run the AI review."));
      const response = await fetch("/api/ai/write", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}`, "X-AJG-Locale": locale },
        body: JSON.stringify({ field: "qualityReview", instruction: "Relis les textes du site et propose uniquement des corrections utiles.", context: { language: config.language, affiliation: config.affiliation, firstName: config.firstName, brandName: config.brandName, siteContext: { ...aiSiteContext, bookingLabel: config.bookingLabel } } })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || tr("Relecture indisponible.", "Review unavailable."));
      setReviewResult(result);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : tr("Relecture indisponible.", "Review unavailable."));
    } finally { setReviewing(false); }
  };

  const uploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !remoteMode) return;

    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) {
      setSyncError(tr("Format non pris en charge. Utilisez une image JPEG, PNG, WebP ou AVIF.", "Unsupported format. Use a JPEG, PNG, WebP or AVIF image."));
      event.target.value = "";
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setSyncError(tr("Cette image dépasse 8 Mo. Choisissez une photo plus légère avant l’envoi.", "This image is larger than 8 MB. Choose a smaller image before uploading."));
      event.target.value = "";
      return;
    }

    setBusy(true);
    setSyncError("");
    try {
      const site = remoteSiteId
        ? { id: remoteSiteId }
        : await saveMySite(config, false, remoteSiteId || undefined);

      if (!remoteSiteId) setRemoteSiteId(site.id);

      const publicUrl = await uploadProfileImage(file, site.id);
      const nextConfig = { ...config, profileImageUrl: publicUrl };
      setConfig(nextConfig);
      saveDraft(nextConfig);
      const savedRemote = await saveMySite(nextConfig, false, remoteSiteId || undefined);
      setRemoteSiteId(savedRemote.id);
      setSaved(true);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : tr("Impossible d’envoyer la photo.", "Unable to upload the photo."));
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  };

  const uploadDesignImage = async (event: ChangeEvent<HTMLInputElement>, category: "background" | "gallery") => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setSyncError("");
    try {
      if (!remoteMode) throw new Error(tr("Connectez le stockage du site avant d’importer une photo.", "Connect website storage before importing a photo."));
      const prepared = category === "background"
        ? await optimizeBackgroundImage(file)
        : { blob: await optimizeImage(file), focus: null };
      const site = remoteSiteId ? { id: remoteSiteId } : await saveMySite(config, false, remoteSiteId || undefined);
      setRemoteSiteId(site.id);
      const url = await uploadSiteImage(prepared.blob, site.id, category);
      const design = category === "background"
        ? {
            ...config.design,
            backgroundPhotoUrl: url,
            backgroundPositionX: prepared.focus?.x ?? 50,
            backgroundPositionY: prepared.focus?.y ?? 50
          }
        : { ...config.design, modules: { ...config.design.modules, gallery: { ...config.design.modules.gallery, images: [...config.design.modules.gallery.images, { url, caption: "" }] } } };
      update("design", design);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : tr("Impossible d’envoyer l’image.", "Unable to upload the image."));
    } finally {
      setUploadingImage(false);
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
        <p>{tr("Chargement de votre espace…", "Loading your workspace…")}</p>
      </main>
    );
  }

  return (
    <main className="builder-shell premium-builder-shell">
      <header className="builder-topbar premium-builder-topbar">
        <Link href="/" className="brand-link premium-brand-link">
          <EltaraBrand compact context="Prototype 0.10" />
        </Link>

        <div className="progress premium-progress" aria-label={tr("Progression ", "Progress ") + completion + "%"}>
          <span style={{ width: completion + "%" }} />
        </div>

        <div className="topbar-account premium-topbar-account">
          {betaTester ? (
            <BetaExperienceSwitch
              inline
              mode={betaExperienceMode}
              onChange={changeBetaExperienceMode}
            />
          ) : adminQa ? (
            <Link className="admin-qa-pill" href="/admin" title={tr("Ce compte administrateur n’est pas un Beta Tester actif.", "This administrator account is not an active Beta Tester.")}>
              <span>QA</span>
              <b>{tr("Admin", "Admin")}</b>
            </Link>
          ) : null}
          <LanguageSwitch compact />
          {ownedSites.length>1?<select aria-label={tr("Site actif", "Active website")} value={remoteSiteId||""} onChange={async e=>{
            const next=await getMySite(e.target.value);
            if(!next)return;
            if(next.privacyState==="erasure_requested"){router.push("/data");return;}
            setRemoteSiteId(next.id);setConfig(next.config);setPublished(next.status==="published");setSaved(true);
            await refreshVerifiedPublicUrl(next.id);
          }}>{ownedSites.map(site=><option key={site.id} value={site.id}>{site.slug}</option>)}</select>:null}
          <Link className="preview-shortcut builder-header-utility" href="/preview">{tr("Aperçu", "Preview")}</Link>
          <span className={"cloud-pill builder-header-status " + (remoteMode ? "online" : "local")}>
            <i />{remoteMode ? "Cloud" : "Local"} · {completion}%
          </span>
          {betaTester && betaExperienceMode === "growth" && published ? (
            <Link href="/growth" className="button primary builder-growth-shortcut">
              GROW <span aria-hidden="true">→</span>
            </Link>
          ) : null}
          {userEmail ? <Link href="/plans" className="button secondary builder-header-action">{tr("Mon offre", "My plan")}</Link> : null}
          {userEmail ? <Link href="/domains" className="button secondary builder-header-action">{tr("Domaines", "Domains")}</Link> : null}
          {userEmail ? <Link href="/data" className="button secondary builder-header-action">{tr("Mes données", "My data")}</Link> : null}
          {userEmail ? <Link href="/feedback" className="button secondary builder-header-action">{tr("Donner mon avis", "Give feedback")}</Link> : null}
          {userEmail ? (
            <button type="button" className="account-button" onClick={logout} title={userEmail}>
              <span>{userEmail.charAt(0).toUpperCase()}</span>
              <b>{tr("Déconnexion", "Sign out")}</b>
            </button>
          ) : null}
        </div>
      </header>

      {adminQa ? (
        <section className="admin-qa-notice" role="status">
          <div>
            <b>{tr("Compte Admin/QA", "Admin/QA account")}</b>
            <span>{tr(
              "Vous pouvez administrer ELTARA, mais ce compte n’a pas de grant Beta Tester actif. Le parcours RUN/GROW n’est donc pas simulé tant que vous ne l’ajoutez pas à la cohorte.",
              "You can administer ELTARA, but this account has no active Beta Tester grant. The RUN/GROW journey is not simulated until you add it to the cohort."
            )}</span>
          </div>
          <Link className="text-link" href="/admin">{tr("Gérer la cohorte bêta", "Manage beta cohort")} →</Link>
        </section>
      ) : null}

      <div className="builder-layout premium-builder-layout">
        <aside className="step-nav premium-step-nav">
          <div className="step-nav-heading">
            <p className="eyebrow">{tr("Votre parcours", "Your journey")}</p>
            <h2>{tr("Construire le site", "Build your website")}</h2>
            <p>{tr("Avancez étape par étape. Vous pouvez revenir sur chaque section à tout moment.", "Move through the steps at your own pace. You can return to any section at any time.")}</p>
            <div className="beginner-promise">
              <span>✓</span>
              <p>{tr("Pas besoin de compétences techniques : remplissez simplement les questions, nous nous occupons du reste.", "No technical skills needed: answer the questions and ELTARA handles the rest.")}</p>
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
                    <b>{locale === "en" ? item.labelEn : item.label}</b>
                    <small>{locale === "en" ? item.eyebrowEn : item.eyebrow}</small>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="step-nav-footer">
            <span>Site</span>
            <strong>{config.brandName || tr("Nouveau site", "New website")}</strong>
            <small>{config.slug ? publicPath : tr("Adresse à définir", "Address to define")}</small>
          </div>
        </aside>

        <section className="panel editor builder-panel premium-builder-panel">
          <div className="panel-heading premium-panel-heading">
            <div className="step-copy">
              <p className="step">{tr("Étape", "Step")} {stepIndex + 1} {tr("sur", "of")} {steps.length} · {currentStep.eyebrow}</p>
              <h1>{currentStep.label}</h1>
              <p className="step-description">{currentStep.description}</p>
            </div>
            <span aria-live="polite" className={"status premium-status " + (published ? "published" : saved ? "saved" : "draft")}>
              <i />
              {busy ? tr("Synchronisation…", "Syncing…") : published ? tr("Publié", "Published") : saved ? tr("Sauvegardé", "Saved") : tr("Brouillon", "Draft")}
            </span>
          </div>

          <div className="editor-body">
            <div className="step-guidance-card">
              <div className="step-guidance-icon">?</div>
              <div>
                <span>{tr("Ce que vous avez à faire", "What you need to do")} · {tr("environ", "about")} {currentStep.time}</span>
                <p>{currentStep.guidance}</p>
              </div>
            </div>
            {syncError ? <div className="error-card premium-error-card"><b>{tr("Synchronisation", "Sync")}</b><p>{syncError}</p></div> : null}

            {step === "identity" ? (
              <>
                <div className="section-kicker">
                  <span>01</span>
                  <div><b>{tr("Votre identité", "Your identity")}</b><p>{tr("Ces informations donnent le ton à tout le site.", "These details shape the tone of your whole website.")}</p></div>
                </div>

                <div className="grid two">
                  <Field label={tr("Prénom", "First name")}>
                    <input spellCheck placeholder="Ex. Julie" value={config.firstName} onChange={(e) => updateIdentityName("firstName", e.target.value)} />
                  </Field>
                  <Field label={tr("Nom", "Last name")}>
                    <input spellCheck placeholder="Ex. Martin" value={config.lastName} onChange={(e) => updateIdentityName("lastName", e.target.value)} />
                  </Field>
                </div>

                <Field label={tr("Nom affiché du site", "Website display name")} hint={tr("Nous le préremplissons avec votre nom. Vous pouvez le remplacer par votre marque si vous en avez une.", "We prefill it with your name. Replace it with your brand name if you have one.")}>
                  <input
                    placeholder={tr("Ex. Julie Martin Voyages", "e.g. Julie Martin Studio")}
                    value={config.brandName}
                    onChange={(e) => {
                      setBrandTouched(true);
                      update("brandName", e.target.value);
                    }}
                  />
                </Field>

                <div className="grid two">
                  <Field label={tr("Adresse souhaitée", "Preferred address")} hint={tr("Exemple : julien-martin", "Example: julie-martin")}>
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

                  <Field label={tr("Langue", "Website language")}>
                    <select
                      value={config.language}
                      onChange={(e) => update("language", e.target.value as SiteLanguage)}
                    >
                      <option value="fr">Français</option>
                      <option value="en">English</option>
                      <option value="both" disabled>{tr("Français + English (à venir)", "French + English (coming soon)")}</option>
                    </select>
                  </Field>
                </div>

                <div className="section-kicker photo-kicker">
                  <span>02</span>
                  <div><b>{tr("Votre photo", "Your photo")}</b><p>{tr("Un visage réel renforce immédiatement la confiance.", "A real face immediately builds trust.")}</p></div>
                </div>

                {remoteMode ? (
                  <Field
                    label={tr("Photo de profil", "Profile photo")}
                    hint={tr("JPEG, PNG, WebP ou AVIF · 8 Mo maximum. La photo est stockée dans votre espace Supabase.", "JPEG, PNG, WebP or AVIF · 8 MB maximum. The photo is stored in your Supabase workspace.")}
                  >
                    <input spellCheck className="file-input" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={uploadPhoto} disabled={busy} />
                  </Field>
                ) : (
                  <Field label={tr("Photo de profil — URL", "Profile photo — URL")} hint={tr("L’upload direct fonctionne dès que Supabase est configuré.", "Direct upload works once Supabase is configured.")}>
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
                    <img src={config.profileImageUrl} alt={tr("Aperçu de la photo de profil", "Profile photo preview")} />
                    <div>
                      <b>{tr("Photo chargée", "Photo uploaded")}</b>
                      <button type="button" onClick={() => update("profileImageUrl", "")}>{tr("Retirer la photo", "Remove photo")}</button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {step === "story" ? (
              <>
                <ContentLibraryEditor value={config.contentLibrary} onChange={(contentLibrary) => update("contentLibrary", contentLibrary)} onUpload={async (_asset, file) => {
                  if (!remoteMode) throw new Error(tr("Connectez-vous pour importer un fichier.", "Sign in to import a file."));
                  const site = remoteSiteId ? { id: remoteSiteId } : await saveMySite(config, false, remoteSiteId || undefined);
                  setRemoteSiteId(site.id);
                  return uploadContentAsset(file, site.id);
                }} />
                <ArchitectureEditor value={config.architecture} library={config.contentLibrary} onChange={(architecture) => update("architecture", architecture)} />
                {showAdvancedDiscovery ? (
                  <details id="advanced-feature-discovery" className="advanced-discovery-card">
                    <summary>
                      <span className="advanced-discovery-icon">✦</span>
                      <span>
                        <b>{premiumAccessHref === "/billing"
                          ? tr("Réactiver mes fonctions avancées", "Restore my advanced features")
                          : tr("Découvrir les fonctions avancées", "Discover advanced features")}</b>
                        <small>{tr(
                          "Votre parcours reste centré sur les outils disponibles. Ouvrez seulement si vous voulez voir ce que Growth ou la Création IA peuvent ajouter.",
                          "Your workflow stays focused on available tools. Open this only if you want to see what Growth or AI Launch can add."
                        )}</small>
                      </span>
                      <span className="advanced-discovery-badge">{tr("Facultatif", "Optional")}</span>
                    </summary>
                    <div className="advanced-discovery-body">
                      {!siteRevisionAvailable ? (
                        <article>
                          <span className="advanced-discovery-kicker">GROWTH</span>
                          <b>{tr("Piloter et faire évoluer le site", "Manage and improve the website")}</b>
                          <p>{tr(
                            "Révisions globales par IA, diagnostics et recommandations continues, SEO/AEO et optimisation de la conversion.",
                            "AI-powered full-site revisions, continuous diagnostics and recommendations, SEO/AEO and conversion optimization."
                          )}</p>
                        </article>
                      ) : null}
                      {!siteArchitectCreateAvailable ? (
                        <article>
                          <span className="advanced-discovery-kicker">BUILD</span>
                          <b>{tr("Faire concevoir le site par l’IA", "Have AI design the website")}</b>
                          <p>{tr(
                            growthActive
                              ? "La Création IA complète reste un droit BUILD distinct ; elle peut être achetée séparément ou incluse selon l’offre Growth annuelle."
                              : "La Création IA complète construit une proposition de site à partir de votre brief. Elle est disponible séparément et peut être incluse avec Growth annuel.",
                            growthActive
                              ? "Full AI Launch remains a separate BUILD entitlement; it can be purchased separately or included depending on the annual Growth offer."
                              : "Full AI Launch builds a website proposal from your brief. It is available separately and may be included with annual Growth."
                          )}</p>
                        </article>
                      ) : null}
                      <div className="advanced-discovery-actions">
                        {betaEssentialSimulation ? (
                          <button type="button" className="button secondary" onClick={() => changeBetaExperienceMode("growth")}>
                            {tr("Tester maintenant l’expérience Growth", "Test the Growth experience now")}
                          </button>
                        ) : (
                          <Link className="button secondary" href={premiumAccessHref}>{premiumAccessLabel}</Link>
                        )}
                        <span>{betaEssentialSimulation
                          ? tr("Vos droits bêta restent complets : le passage en Growth est instantané et sans paiement.", "Your beta rights remain complete: switching to Growth is instant and requires no payment.")
                          : tr("Aucune fonction verrouillée n’encombre votre éditeur.", "Locked features do not clutter your editor.")}</span>
                      </div>
                    </div>
                  </details>
                ) : null}
                {siteArchitectCreateAvailable ? (
                <details id="ai-site-architect" className="guided-writing-card ai-architect-card">
                  <summary>
                    <span className="guided-writing-icon">✦</span>
                    <span><b>{tr("Créer mon site avec l’IA", "Create my website with AI")}</b><small>{tr("BUILD · décrivez votre besoin et obtenez une proposition complète à valider.", "BUILD · describe what you need and get a complete proposal to review.")}</small></span>
                    <span className="guided-writing-badge">{tr("BUILD disponible", "BUILD available")}</span>
                  </summary>
                  <div className="guided-writing-body">
                    <p className="guided-writing-intro">{tr("Décrivez votre besoin librement. L’Architecte Premium commence par comprendre votre activité, votre public, votre objectif et votre positionnement, puis construit le parcours du visiteur, l’architecture, les textes et la direction visuelle. Chaque proposition passe ensuite par un audit critique avant de vous être montrée.", "Describe what you need in your own words. The Premium Site Architect first understands your business, audience, goal and positioning, then builds the visitor journey, architecture, copy and visual direction. Every proposal goes through a critical quality review before you see it.")}</p>
                    <div className="architect-brief-guide">
                      <b>{tr("Pour un résultat exceptionnel, indiquez si vous les connaissez :", "For the strongest result, include these details when you know them:")}</b>
                      <span>{tr("ce que vous proposez · à qui · l’action attendue · ce qui vous différencie · le ton souhaité · les contraintes à respecter", "what you offer · who it is for · the desired action · what makes you different · the tone you want · constraints to respect")}</span>
                    </div>
                    <label className="guided-question">
                      <span>{tr("Votre besoin", "What you need")}</span>
                      <textarea rows={8} maxLength={4000} value={architectBrief} onChange={(e) => setArchitectBrief(e.target.value)} disabled={!siteArchitectCreateAvailable} placeholder={tr("Ex. Je suis photographe indépendant à Toulouse. Je travaille surtout avec des couples et des familles qui veulent des images naturelles. Le site doit montrer mon univers, rassurer sur mon approche et donner envie de me contacter. Je veux éviter le ton commercial agressif : quelque chose d’élégant, chaleureux, humain et très visuel. Je veux mettre en avant la lumière naturelle, l’émotion et la simplicité.", "e.g. I’m an independent photographer working mainly with couples and families who want natural images. The website should showcase my style, reassure people about my approach and make them want to contact me. I want an elegant, warm, human and highly visual tone without aggressive sales language.")} />
                      <small className={"architect-brief-readiness " + (architectBriefReady ? "is-ready" : "is-thin")}>
                        {architectBriefReady
                          ? tr("Brief suffisamment détaillé pour lancer l’analyse Premium.", "Your brief is detailed enough to start the Premium analysis.")
                          : architectBriefLength === 0
                            ? tr("Commencez par quelques phrases : activité, public, objectif et ton souhaité.", "Start with a few sentences about your activity, audience, goal and desired tone.")
                            : tr(`Encore ${80 - architectBriefLength} caractère${80 - architectBriefLength > 1 ? "s" : ""} environ pour donner assez de matière à l’Architecte.`, `About ${80 - architectBriefLength} more character${80 - architectBriefLength > 1 ? "s" : ""} needed to give the Site Architect enough context.`)}
                      </small>
                    </label>
                    <button type="button" className="button primary premium-button" disabled={!siteArchitectCreateAvailable || architectLoading || !architectBriefReady} onClick={() => void createSiteWithAi()}>{architectLoading ? tr("Stratégie, création et audit en cours…", "Strategy, creation and quality review in progress…") : tr("Créer avec le Concepteur IA", "Create with the AI Site Architect")} <span aria-hidden="true">→</span></button>
                    {architectProposal ? (
                      <div className="ai-current-note architect-premium-result" role="status">
                        <div className="architect-result-heading">
                          <div>
                            <b>{tr("Proposition BUILD prête à relire", "BUILD proposal ready to review")}</b>
                            <p><strong>{architectProposal.heroTitle}</strong><br />{architectProposal.heroSubtitle}</p>
                          </div>
                          <span className={"architect-readiness " + architectProposal.intelligence.readiness}>
                            {architectProposal.intelligence.readiness === "strong" ? tr("Brief solide", "Strong brief") : architectProposal.intelligence.readiness === "usable" ? tr("Brief exploitable", "Usable brief") : tr("Brief partiel", "Partial brief")}
                          </span>
                        </div>
                        <div className="architect-insight-grid">
                          <article><span>{tr("Besoin compris", "Understood need")}</span><p>{architectProposal.intelligence.understoodNeed}</p></article>
                          <article><span>{tr("Public principal", "Primary audience")}</span><p>{architectProposal.intelligence.audience}</p></article>
                          <article><span>{tr("Objectif du site", "Website goal")}</span><p>{architectProposal.intelligence.primaryGoal}</p></article>
                          <article><span>{tr("Positionnement", "Positioning")}</span><p>{architectProposal.intelligence.positioning}</p></article>
                        </div>
                        {architectProposal.intelligence.visitorJourney.length ? (
                          <div className="architect-journey">
                            <b>{tr("Parcours visiteur conçu par l’IA", "Visitor journey designed by AI")}</b>
                            <div>{architectProposal.intelligence.visitorJourney.map((item, index) => <span key={item + index}><i>{index + 1}</i>{item}</span>)}</div>
                          </div>
                        ) : null}
                        <div className="architect-rationale-grid">
                          <article><b>{tr("Pourquoi cette architecture ?", "Why this architecture?")}</b><p>{architectProposal.intelligence.architectureRationale}</p></article>
                          <article><b>{tr("Pourquoi cette direction visuelle ?", "Why this visual direction?")}</b><p>{architectProposal.intelligence.designRationale}</p></article>
                        </div>
                        <p>{tr("Rubriques recommandées", "Recommended sections")}: {(architectProposal.recommendedModules || []).join(", ") || tr("aucune rubrique supplémentaire", "no additional section")}.</p>
                        <p>{tr("Architecture :", "Architecture:")} {architectProposal.architecture?.mode === "multi" ? `${architectProposal.architecture.pages.length} ${tr("pages", "pages")}` : tr("site monopage", "single-page website")} · {(architectProposal.architecture?.pages || []).map((page) => page.title).join(" → ")}.</p>
                        <p>{tr("Structure :", "Structure:")} {architectProposal.design?.layout} · hero {architectProposal.design?.heroLayout} · {tr("largeur", "width")} {architectProposal.design?.contentWidth}.</p>
                        <p>{tr("Direction visuelle :", "Visual direction:")} <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: "50%", background: architectProposal.design?.accent, verticalAlign: "middle", marginRight: 6 }} /> {architectProposal.design?.background} · {architectProposal.design?.pattern === "none" ? tr("fond uni", "solid background") : `${tr("motif", "pattern")} ${architectProposal.design?.pattern}`}.</p>
                        <div className="architect-audit">
                          <b>
                            ✓ {architectProposal.premiumAudit.finalReviewPerformed
                              ? tr("Double contrôle Premium validé", "Premium double-check passed")
                              : tr("Audit Premium validé", "Premium audit passed")}
                          </b>
                          <p>{architectProposal.premiumAudit.qualityNote}</p>
                          {architectProposal.premiumAudit.finalReviewPerformed ? (
                            <small>
                              {tr("Le texte affiché a été relu une seconde fois après correction par un critique IA indépendant.", "The displayed copy was reviewed a second time after correction by an independent AI critic.")}
                            </small>
                          ) : null}
                          {architectProposal.premiumAudit.strategyReused ? (
                            <small>
                              {tr("Variante efficiente : la stratégie déjà validée a été conservée, puis la création et les contrôles qualité ont été relancés.", "Efficient variant: the already validated strategy was preserved, then creation and quality checks were rerun.")}
                            </small>
                          ) : null}
                          {architectProposal.premiumAudit.deterministicChecksPerformed ? (
                            <small>
                              {tr("Contrôle structurel automatique validé", "Automated structural check passed")} · {architectProposal.premiumAudit.deterministicIssuesDetected} {tr("alerte(s) résiduelle(s)", "remaining alert(s)")} · {tr("aucun blocage", "no blocking issue")}.
                            </small>
                          ) : null}
                          {architectProposal.premiumAudit.strengths.length ? <small>{tr("Points forts :", "Strengths:")} {architectProposal.premiumAudit.strengths.join(" · ")}</small> : null}
                        </div>
                        <div className="architect-human-eval">
                          <div>
                            <b>{tr("Cette proposition correspond-elle vraiment à votre besoin ?", "Does this proposal genuinely match what you need?")}</b>
                            <small>{tr("Votre réponse aide à améliorer l’Architecte. Aucun texte de votre site n’est envoyé avec cette évaluation.", "Your feedback helps improve the Site Architect. No website copy is sent with this rating.")}</small>
                          </div>
                          {architectQualitySubmitted ? (
                            <p className="architect-human-eval-thanks">
                              ✓ {tr("Merci. Votre évaluation est enregistrée.", "Thank you. Your feedback has been recorded.")}
                            </p>
                          ) : (
                            <>
                              <div className="architect-human-eval-actions">
                                <button
                                  type="button"
                                  className={"button secondary " + (architectQualityChoice === "positive" ? "is-selected" : "")}
                                  disabled={architectQualityBusy}
                                  onClick={() => void submitArchitectRating("positive")}
                                >
                                  {tr("Oui, c’est pertinent", "Yes, this is relevant")}
                                </button>
                                <button
                                  type="button"
                                  className={"button secondary " + (architectQualityChoice === "negative" ? "is-selected" : "")}
                                  disabled={architectQualityBusy}
                                  onClick={() => setArchitectQualityChoice("negative")}
                                >
                                  {tr("À améliorer", "Needs improvement")}
                                </button>
                              </div>
                              {architectQualityChoice === "negative" ? (
                                <div className="architect-human-eval-reasons">
                                  <span>{tr("Qu’est-ce qui vous gêne surtout ?", "What needs the most improvement?")}</span>
                                  {([
                                    ["need_mismatch", tr("Compréhension du besoin", "Understanding the need")],
                                    ["copy", tr("Textes", "Copy")],
                                    ["structure", tr("Structure / rubriques", "Structure / sections")],
                                    ["design", tr("Direction visuelle", "Visual direction")],
                                    ["generic", tr("Trop générique", "Too generic")],
                                    ["other", tr("Autre", "Other")]
                                  ] as Array<[ArchitectQualityReason, string]>).map(([reason, label]) => (
                                    <button
                                      key={reason}
                                      type="button"
                                      className={architectQualityReason === reason ? "is-selected" : ""}
                                      onClick={() => setArchitectQualityReason(reason)}
                                    >
                                      {label}
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    className="button primary"
                                    disabled={!architectQualityReason || architectQualityBusy}
                                    onClick={() => void submitArchitectRating("negative", architectQualityReason)}
                                  >
                                    {architectQualityBusy ? tr("Enregistrement…", "Saving…") : tr("Envoyer mon évaluation", "Submit feedback")}
                                  </button>
                                </div>
                              ) : null}
                            </>
                          )}
                        </div>
                        {architectProposal.intelligence.missingInformation.length ? (
                          <div className="architect-missing architect-clarification">
                            <b>{tr("L’Architecte a encore quelques questions", "The Site Architect has a few more questions")}</b>
                            <p>{tr("Ces réponses sont facultatives. Répondez uniquement à ce que vous connaissez : l’IA réutilisera vos réponses pour reconstruire et réauditer la proposition sans inventer le reste.", "These answers are optional. Answer only what you know: AI will reuse your answers to rebuild and reaudit the proposal without inventing the rest.")}</p>
                            <div className="architect-clarification-list">
                              {architectProposal.intelligence.missingInformation.map((question, index) => (
                                <label key={question}>
                                  <span><i>{index + 1}</i>{question}</span>
                                  <textarea
                                    rows={2}
                                    maxLength={500}
                                    value={architectClarifications[question] || ""}
                                    onChange={(event) =>
                                      setArchitectClarifications((current) => ({
                                        ...current,
                                        [question]: event.target.value
                                      }))
                                    }
                                    placeholder={tr("Votre réponse, si vous la connaissez…", "Your answer, if you know it…")}
                                  />
                                </label>
                              ))}
                            </div>
                            <button
                              type="button"
                              className="button secondary architect-clarification-button"
                              disabled={
                                architectLoading ||
                                !Object.values(architectClarifications).some((value) => value.trim())
                              }
                              onClick={() => void improveArchitectWithClarifications()}
                            >
                              {architectLoading ? tr("Nouvelle analyse en cours…", "Running a new analysis…") : tr("Améliorer avec mes réponses", "Improve with my answers")}
                            </button>
                          </div>
                        ) : null}
                        <div className="ai-field-actions"><button type="button" className="button primary premium-button" onClick={() => applyArchitectProposal(architectProposal)}>{tr("Appliquer cette proposition", "Apply this proposal")}</button><button type="button" className="button secondary" onClick={() => void createSiteWithAi()}>{tr("Nouvelle proposition", "New proposal")}</button></div>
                        <small>{tr("Rien n’est publié automatiquement. Après application, chaque texte et chaque rubrique restent modifiables.", "Nothing is published automatically. After applying the proposal, every text and section remains editable.")}</small>
                      </div>
                    ) : null}
                  </div>
                </details>
                ) : null}
                {showGrowthRevisionWorkspace ? (
                <details className="guided-writing-card ai-architect-card growth-revision-card">
                  <summary><span className="guided-writing-icon">↻</span><span><b>{tr("Modifier tout le site avec l’IA", "Revise the whole website with AI")}</b><small>{tr("Growth · demandez une évolution globale sans écraser automatiquement votre version actuelle.", "Growth · request a global revision without automatically overwriting your current version.")}</small></span><span className="guided-writing-badge">{tr("Aperçu avant application", "Preview before applying")}</span></summary>
                  <div className="guided-writing-body">
                    <p className="guided-writing-intro">{tr("Exemples : « rends le site plus haut de gamme », « passe à trois pages », « mets davantage l’accent sur les familles », « utilise mes photos sur la galerie et simplifie l’accueil ».", "Examples: “make the website feel more premium”, “switch to three pages”, “focus more on families”, “use my photos in the gallery and simplify the homepage”.")}</p>
                    <label className="guided-question"><span>{tr("Modification souhaitée", "Requested change")}</span><textarea rows={4} maxLength={1200} value={revisionRequest} onChange={(e) => setRevisionRequest(e.target.value)} disabled={!siteRevisionAvailable} placeholder={tr("Décrivez ce que vous voulez changer. L’IA préservera le reste autant que possible.", "Describe what you want to change. AI will preserve the rest as much as possible.")} /></label>
                    <button type="button" className="button primary premium-button" disabled={!siteRevisionAvailable || revisionLoading || !revisionRequest.trim()} onClick={requestGlobalRevision}>{revisionLoading ? tr("Préparation de la révision…", "Preparing revision…") : tr("Préparer la révision", "Prepare revision")} <span aria-hidden="true">→</span></button>
                    {revisionProposal ? (
                      <div className="ai-current-note revision-preview" role="status">
                        <b>{tr("Révision prête à comparer", "Revision ready to compare")}</b>
                        <p><strong>{revisionProposal.heroTitle}</strong><br />{revisionProposal.heroSubtitle}</p>
                        <div className="revision-scope-summary">
                          <span>{tr("Zones modifiées", "Changed areas")}</span>
                          {revisionChangeSummary.length ? (
                            <div>{revisionChangeSummary.map((item) => <em key={item}>{item}</em>)}</div>
                          ) : (
                            <p>{tr("Aucune différence détectée avec votre version actuelle.", "No difference detected from your current version.")}</p>
                          )}
                          <small>
                            {tr("Tout élément absent de cette liste est conservé. L’IA reçoit aussi cette règle comme contrainte de qualité pendant la révision.", "Anything not listed here is preserved. AI also receives this rule as a quality constraint during revision.")}
                          </small>
                        </div>
                        <p>{tr("Architecture proposée :", "Proposed architecture:")} {revisionProposal.architecture.mode === "multi" ? `${revisionProposal.architecture.pages.length} ${tr("pages", "pages")}` : tr("site monopage", "single-page website")} · {revisionProposal.architecture.pages.map((page) => page.title).join(" → ")}.</p>
                        <p>{tr("Structure :", "Structure:")} {revisionProposal.design.layout} · hero {revisionProposal.design.heroLayout} · {tr("largeur", "width")} {revisionProposal.design.contentWidth}.</p>
                        <div className="ai-field-actions">
                          <button type="button" className="button primary premium-button" onClick={() => applyArchitectProposal(revisionProposal)} disabled={revisionChangeSummary.length === 0}>{tr("Appliquer cette révision", "Apply this revision")}</button>
                          <button type="button" className="button secondary" onClick={() => setRevisionProposal(null)}>{tr("Conserver mon site actuel", "Keep my current website")}</button>
                        </div>
                        <small>{tr("Votre site actuel reste inchangé tant que vous n’appliquez pas cette proposition.", "Your current website remains unchanged until you apply this proposal.")}</small>
                      </div>
                    ) : null}
                  </div>
                </details>
                ) : null}
                <details className="guided-writing-card" open>
                  <summary>
                    <span className="guided-writing-icon">✦</span>
                    <span>
                      <b>{tr("Mode guidé recommandé", "Recommended guided mode")}</b>
                      <small>{tr("Répondez à 3 questions simples, puis à une 4e facultative : nous préparons une première version de vos textes.", "Answer 3 simple questions, plus an optional fourth one, and we’ll prepare a first draft of your copy.")}</small>
                    </span>
                    <span className="guided-writing-badge">{tr("Le plus simple", "Easiest")}</span>
                  </summary>

                  <div className="guided-writing-body">
                    <p className="guided-writing-intro">
                      {tr("Pas besoin de savoir rédiger un site. Répondez comme vous parleriez à quelqu’un.", "You do not need to know how to write a website. Answer as you would speak to someone.")}{" "}
                      {tr("Vous pourrez modifier chaque phrase ensuite.", "You can edit every sentence afterwards.")}
                    </p>

                    <label className="guided-question">
                      <span><i>1</i> {tr("Que proposez-vous ou quelle est votre activité ?", "What do you offer or what is your activity?")}</span>
                      <textarea
                        rows={3}
                        placeholder={tr("Ex. Je suis photographe de famille et de couple, avec une approche naturelle et peu posée.", "e.g. I’m a family and couples photographer with a natural, relaxed approach.")}
                        value={guidedAnswers.activity}
                        onChange={(e) => setGuidedAnswers((current) => ({ ...current, activity: e.target.value }))}
                      />
                    </label>

                    <label className="guided-question">
                      <span><i>2</i> {tr("Qu'est-ce qui caractérise votre approche ?", "What defines your approach?")}</span>
                      <textarea
                        rows={3}
                        placeholder={tr("Ex. Je prends le temps de mettre les personnes à l’aise et je privilégie des images spontanées, simples et lumineuses.", "e.g. I take time to make people feel comfortable and I favor natural, simple and bright images.")}
                        value={guidedAnswers.difference}
                        onChange={(e) => setGuidedAnswers((current) => ({ ...current, difference: e.target.value }))}
                      />
                    </label>

                    <label className="guided-question">
                      <span><i>3</i> {tr("Que voulez-vous que le visiteur comprenne ou fasse ?", "What do you want visitors to understand or do?")}</span>
                      <textarea
                        rows={3}
                        placeholder={tr("Ex. Je veux qu’il comprenne mon style, se sente rassuré sur le déroulement et ait envie de me contacter.", "e.g. I want them to understand my style, feel reassured about the process and want to contact me.")}
                        value={guidedAnswers.goal}
                        onChange={(e) => setGuidedAnswers((current) => ({ ...current, goal: e.target.value }))}
                      />
                    </label>

                    <label className="guided-question optional">
                      <span><i>4</i> {tr("À qui souhaitez-vous surtout parler ?", "Who do you mainly want to speak to?")} <em>{tr("facultatif", "optional")}</em></span>
                      <textarea
                        rows={2}
                        placeholder={tr("Ex. Aux familles et aux couples qui cherchent quelque chose de naturel, chaleureux et sans mise en scène excessive.", "e.g. Families and couples looking for something natural, warm and not overly staged.")}
                        value={guidedAnswers.audience}
                        onChange={(e) => setGuidedAnswers((current) => ({ ...current, audience: e.target.value }))}
                      />
                    </label>

                    <button
                      type="button"
                      className="button primary premium-button guided-generate-button"
                      disabled={!guidedDraftEnabled}
                      onClick={createGuidedDraft}
                    >
                      {guidedDraftReady ? tr("✓ Textes préparés — actualiser", "✓ Copy prepared — refresh") : tr("Préparer mes textes", "Prepare my copy")}
                      <span aria-hidden="true">→</span>
                    </button>

                    {!guidedDraftEnabled ? (
                      <p className="guided-writing-help">{tr("Répondez aux 3 premières questions pour préparer vos textes.", "Answer the first 3 questions to prepare your copy.")}</p>
                    ) : guidedDraftReady ? (
                      <p className="guided-writing-success">{tr("Votre première version est prête juste en dessous. Relisez-la et modifiez ce qui ne vous ressemble pas.", "Your first version is ready below. Review it and change anything that does not sound like you.")}</p>
                    ) : null}
                  </div>
                </details>

                <div className="section-kicker">
                  <span>01</span>
                  <div><b>{tr("Votre texte d’accueil", "Your homepage copy")}</b><p>{tr("Le visiteur doit comprendre en quelques secondes ce que vous lui proposez.", "Visitors should understand what you offer within a few seconds.")}</p></div>
                </div>
                <div className="question-prompt">
                  <b>{tr("Vous gardez toujours le dernier mot.", "You always have the final say.")}</b>
                  <p>{tr("La version préparée n’est qu’un point de départ. Changez les mots pour qu’ils vous ressemblent vraiment.", "The prepared version is only a starting point. Change the wording so it genuinely sounds like you.")}</p>
                </div>
                <Field label={tr("Petite phrase au-dessus du titre", "Short line above the headline")} hint={tr("Facultatif. Exemple : Voyagez autrement · partagez davantage.", "Optional. Example: A simpler way to travel and share.")}>
                  <input spellCheck maxLength={90} value={config.heroTagline} onChange={(e) => update("heroTagline", e.target.value)} placeholder={tr("Voyage d’abord · découverte ensuite", "Your activity · your difference")} />
                </Field>
                <AiTextAssistant
                  field="heroTagline"
                  label="cette petite phrase"
                  value={config.heroTagline}
                  language={config.language}
                  affiliation={config.affiliation}
                  firstName={config.firstName}
                  brandName={config.brandName}
                  siteContext={aiSiteContext}
                  onApply={(text) => update("heroTagline", text)}
                  placeholder={tr("Ex. Une phrase très courte qui résume mon univers sans slogan commercial générique", "e.g. A very short tagline that captures my identity without a generic sales slogan")}
                />
                <Field label={tr("Titre principal", "Main headline")}>
                  <textarea spellCheck rows={2} placeholder={tr("Ex. Une autre façon de préparer et profiter de vos voyages", "e.g. A clearer, simpler way to discover what I offer")} value={config.heroTitle} onChange={(e) => update("heroTitle", e.target.value)} />
                </Field>
                <AiTextAssistant
                  field="heroTitle"
                  label="le titre principal"
                  value={config.heroTitle}
                  language={config.language}
                  affiliation={config.affiliation}
                  firstName={config.firstName}
                  brandName={config.brandName}
                  siteContext={aiSiteContext}
                  onApply={(text) => update("heroTitle", text)}
                  placeholder={tr("Ex. Un titre clair et mémorable qui fait comprendre rapidement ce que je propose", "e.g. A clear, memorable headline that quickly explains what I offer")}
                />
                <Field label={tr("Introduction", "Introduction")}>
                  <textarea spellCheck rows={5} placeholder={tr("En 2 ou 3 phrases : ce que vous avez découvert, ce que cela vous apporte et pourquoi vous souhaitez le partager.", "In 2 or 3 sentences: what you offer, what it brings to people and why it matters.")} value={config.heroSubtitle} onChange={(e) => update("heroSubtitle", e.target.value)} />
                </Field>
                <AiTextAssistant
                  field="heroSubtitle"
                  label="l'introduction"
                  value={config.heroSubtitle}
                  language={config.language}
                  affiliation={config.affiliation}
                  firstName={config.firstName}
                  brandName={config.brandName}
                  siteContext={aiSiteContext}
                  onApply={(text) => update("heroSubtitle", text)}
                  placeholder={tr("Ex. Explique en 2 phrases mon activité, mon approche et ce que le visiteur peut attendre, avec un ton naturel", "e.g. Explain my activity, approach and what visitors can expect in 2 natural sentences")}
                />

                <div className="section-kicker">
                  <span>02</span>
                  <div><b>{tr("Votre présentation", "Your introduction")}</b><p>{tr("Quelques lignes suffisent si elles sonnent juste et restent personnelles.", "A few lines are enough when they feel authentic and personal.")}</p></div>
                </div>
                <Field label={tr("Titre de la rubrique", "Section title")} hint={tr("Facultatif. Votre nom est utilisé si ce champ reste vide.", "Optional. Your name is used if this field is left empty.")}>
                  <input spellCheck maxLength={100} value={config.aboutHeading} onChange={(e) => update("aboutHeading", e.target.value)} placeholder="Ex. Mon histoire" />
                </Field>
                <AiTextAssistant
                  field="aboutHeading"
                  label={tr("le titre de votre présentation", "your presentation title")}
                  value={config.aboutHeading}
                  language={config.language}
                  affiliation={config.affiliation}
                  firstName={config.firstName}
                  brandName={config.brandName}
                  siteContext={aiSiteContext}
                  onApply={(text) => update("aboutHeading", text)}
                  placeholder={tr("Ex. Un titre personnel et simple, moins formel que « À propos »", "e.g. A personal, simple heading that feels less formal than “About”")}
                />
                <Field label={tr("Votre présentation", "About you")}>
                  <textarea spellCheck rows={7} placeholder={tr("Parlez de vous comme vous le feriez à quelqu’un que vous venez de rencontrer : votre parcours, votre expérience et ce que vous aimez partager.", "Introduce yourself as you would to someone you have just met: your background, experience and what you enjoy sharing.")} value={config.aboutText} onChange={(e) => update("aboutText", e.target.value)} />
                </Field>
                <AiTextAssistant
                  field="aboutText"
                  label={tr("votre présentation", "your presentation")}
                  value={config.aboutText}
                  language={config.language}
                  affiliation={config.affiliation}
                  firstName={config.firstName}
                  brandName={config.brandName}
                  siteContext={aiSiteContext}
                  onApply={(text) => update("aboutText", text)}
                  placeholder={tr("Ex. Présente-moi de façon humaine à partir de mon parcours, de mon approche et de ce qui compte dans ma façon de travailler", "e.g. Introduce me in a human way based on my background, approach and what matters in how I work")}
                />
              </>
            ) : null}

            {step === "design" ? (
              <>
                <MediaLibrary design={config.design} onChange={(design) => update("design", design)} />
                <div className="photo-background-editor module-editor">
                  <b>{tr("Photo personnelle en arrière-plan", "Personal background photo")}</b>
                  <p>{tr("La photo est compressée avant l’envoi et affichée en mode cover. AJG cherche automatiquement le point d’intérêt de l’image pour le centrage initial ; vous pouvez ensuite l’ajuster avec les curseurs.", "The photo is compressed before upload and displayed in cover mode. AJG automatically finds an initial focal point, which you can then adjust with the sliders.")}</p>
                  <label className="background-upload-field">{tr("Importer une photo", "Upload a photo")}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploadingImage || busy} onChange={(event) => void uploadDesignImage(event, "background")} /></label>
                  {uploadingImage ? <p className="background-upload-status" role="status">{tr("Optimisation et envoi de la photo…", "Optimizing and uploading photo…")}</p> : null}
                  {config.design.backgroundPhotoUrl ? (
                    <div className="background-photo-adjustments">
                      <button type="button" className="button secondary background-remove-button" onClick={() => update("design", { ...config.design, backgroundPhotoUrl: "" })}>{tr("Retirer la photo de fond", "Remove background photo")}</button>
                      <label className="background-position-control">
                        <span>{tr("Position horizontale", "Horizontal position")} <strong>{config.design.backgroundPositionX} %</strong></span>
                        <input aria-label={tr("Position horizontale de la photo de fond", "Background photo horizontal position")} type="range" min="0" max="100" step="1" value={config.design.backgroundPositionX} onChange={(e) => update("design", { ...config.design, backgroundPositionX: Number(e.target.value) })} />
                        <small><span>{tr("Gauche", "Left")}</span><span>{tr("Droite", "Right")}</span></small>
                      </label>
                      <label className="background-position-control">
                        <span>{tr("Position verticale", "Vertical position")} <strong>{config.design.backgroundPositionY} %</strong></span>
                        <input aria-label={tr("Position verticale de la photo de fond", "Background photo vertical position")} type="range" min="0" max="100" step="1" value={config.design.backgroundPositionY} onChange={(e) => update("design", { ...config.design, backgroundPositionY: Number(e.target.value) })} />
                        <small><span>{tr("Haut", "Top")}</span><span>{tr("Bas", "Bottom")}</span></small>
                      </label>
                    </div>
                  ) : null}
                </div>
                <label className="option-card premium-option-card portrait-option">
                  <input spellCheck type="checkbox" checked={config.design.showPortrait} onChange={(event) => update("design", { ...config.design, showPortrait: event.target.checked })} />
                  <span><b>{tr("Afficher le portrait dans l’accueil", "Show portrait on homepage")}</b><p>{tr("Si vous n’avez pas ajouté de photo, vos initiales apparaissent. Décochez pour laisser davantage de place à l’image de fond.", "If you have not added a photo, your initials are shown. Turn this off to give more space to the background image.")}</p></span>
                </label>
              </>
            ) : null}

            {step === "booking" ? (
              <>
                <div className="visibility-options-stack">
                  <VisibilityOption
                    checked={config.design.showBooking}
                    title={tr("Rendez-vous sur le site", "Bookings on the website")}
                    activeLabel={tr("Activé", "Enabled")}
                    inactiveLabel={tr("Désactivé", "Disabled")}
                    description={config.design.showBooking
                      ? tr("Les accès au rendez-vous peuvent apparaître sur le site dès qu’un lien valide est renseigné.", "Booking access can appear on the website as soon as a valid link is provided.")
                      : tr("Tous les accès au rendez-vous sont masqués. Le texte et le lien restent enregistrés pour plus tard.", "All booking access is hidden. The text and link remain saved for later.")}
                    onChange={(checked) => update("design", { ...config.design, showBooking: checked })}
                  />
                  {config.design.showBooking ? (
                    <VisibilityOption
                      checked={config.design.showPrimaryButton}
                      title={tr("Bouton principal dans l’accueil", "Primary homepage button")}
                      activeLabel={tr("Visible", "Visible")}
                      inactiveLabel={tr("Masqué", "Hidden")}
                      description={config.design.showPrimaryButton
                        ? tr("Avec un lien valide, le bouton apparaît dans le hero en plus de l’accès dans la navigation.", "With a valid link, the button appears in the hero in addition to navigation access.")
                        : tr("Avec un lien valide, l’accès reste dans la navigation mais le gros bouton du hero est masqué.", "With a valid link, booking remains available in navigation but the large hero button is hidden.")}
                      onChange={(checked) => update("design", { ...config.design, showPrimaryButton: checked })}
                    />
                  ) : null}
                </div>
                <div className={`booking-visibility-summary ${!config.design.showBooking || bookingLinkStatus !== "valid" ? "warning" : "active"}`}>
                  <span aria-hidden="true">{!config.design.showBooking ? "○" : bookingLinkStatus === "valid" ? "✓" : "!"}</span>
                  <div>
                    <b>{tr("Ce que verra le visiteur", "What visitors will see")}</b>
                    <p>
                      {!config.design.showBooking
                        ? tr("Aucun accès au rendez-vous : la fonction est désactivée.", "No booking access: the feature is disabled.")
                        : bookingLinkStatus !== "valid"
                          ? tr("Aucun bouton pour le moment : ajoutez un lien de rendez-vous HTTPS valide ci-dessous.", "No button for now: add a valid HTTPS booking link below.")
                          : config.design.showPrimaryButton
                            ? tr("Un accès dans la navigation + le bouton principal dans l’accueil.", "Navigation access plus the primary homepage button.")
                            : tr("Un accès dans la navigation uniquement. Le bouton principal de l’accueil est masqué.", "Navigation access only. The primary homepage button is hidden.")}
                    </p>
                  </div>
                </div>
                <div className="booking-guide">
                  <b>{tr("Comment ajouter votre agenda ?", "How do I add my booking page?")}</b>
                  <ol>
                    <li>{tr("Ouvrez votre page de réservation Calendly, Google Calendar ou un autre agenda.", "Open your Calendly, Google Calendar or other booking page.")}</li>
                    <li>{tr("Copiez son adresse dans la barre du navigateur ou avec le bouton de partage.", "Copy its address from the browser bar or using the share button.")}</li>
                    <li>{tr("Collez cette adresse dans le champ ci-dessous. Un message confirmera si le lien est complet.", "Paste the address into the field below. A message will confirm whether the link is complete.")}</li>
                  </ol>
                  <p>{tr("Vous n’avez pas encore d’agenda en ligne ? Laissez le champ vide pour le moment.", "No online booking page yet? Leave the field empty for now.")}</p>
                </div>
                <div className="section-kicker">
                  <span>01</span>
                  <div><b>{tr("Votre rendez-vous", "Your booking link")}</b><p>{tr("Un seul lien suffit pour transformer l’intérêt en échange.", "One link is enough to turn interest into a conversation.")}</p></div>
                </div>
                <Field label={tr("Texte du bouton", "Button text")} hint={tr("Ce texte apparaîtra sur le bouton lorsque vous aurez ajouté un lien de rendez-vous.", "This text appears on the button once you add a booking link.")}>
                  <input spellCheck placeholder={tr("Ex. Découvrir la plateforme", "e.g. Discover more")} value={config.bookingLabel} onChange={(e) => update("bookingLabel", e.target.value)} />
                </Field>
                <AiTextAssistant
                  field="bookingLabel"
                  label={tr("le bouton de rendez-vous", "the booking button")}
                  value={config.bookingLabel}
                  language={config.language}
                  affiliation={config.affiliation}
                  firstName={config.firstName}
                  brandName={config.brandName}
                  siteContext={aiSiteContext}
                  onApply={(text) => update("bookingLabel", text)}
                  placeholder={tr("Ex. Un appel à l’action rassurant, sans pression commerciale", "e.g. A reassuring call to action without sales pressure")}
                />
                <Field label={tr("Lien de rendez-vous", "Booking link")} hint={tr("Facultatif. Le lien doit commencer par https:// et contenir l’adresse complète de votre page.", "Optional. The link must start with https:// and contain the full address of your booking page.")}>
                  <input
                    type="url"
                    inputMode="url"
                    autoComplete="url"
                    aria-invalid={bookingLinkStatus === "invalid"}
                    aria-describedby="booking-link-feedback"
                    placeholder="https://calendly.com/votre-nom/30min"
                    value={config.bookingUrl}
                    onChange={(e) => update("bookingUrl", e.target.value)}
                  />
                </Field>
                <p id="booking-link-feedback" className={"booking-link-feedback " + bookingLinkStatus} role="status">
                  {bookingLinkStatus === "valid"
                    ? tr("✓ Lien reconnu. Vérifiez qu’il ouvre bien votre page de réservation.", "✓ Link recognized. Check that it opens your booking page correctly.")
                    : bookingLinkStatus === "invalid"
                      ? tr("Le lien semble incomplet. Copiez l’adresse entière, par exemple https://calendly.com/votre-nom/30min.", "The link looks incomplete. Copy the full address, for example https://calendly.com/your-name/30min.")
                      : tr("Vous pouvez continuer sans lien et l’ajouter plus tard.", "You can continue without a link and add it later.")}
                </p>

                <div className="section-kicker">
                  <span>02</span>
                  <div><b>{tr("Vos réseaux", "Your social profiles")}</b><p>{tr("Optionnels, mais utiles pour prolonger la relation hors du site.", "Optional, but useful for continuing the relationship beyond the website.")}</p></div>
                </div>
                <div className="grid two">
                  <label className="option-card premium-option-card"><input type="checkbox" checked={config.design.showInstagram} onChange={(e) => update("design", { ...config.design, showInstagram: e.target.checked })} /><span><b>{tr("Afficher Instagram", "Show Instagram")}</b></span></label>
                  <label className="option-card premium-option-card"><input type="checkbox" checked={config.design.showFacebook} onChange={(e) => update("design", { ...config.design, showFacebook: e.target.checked })} /><span><b>{tr("Afficher Facebook", "Show Facebook")}</b></span></label>
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
                  <div><b>{tr("Modules du site", "Website sections")}</b><p>{tr("Les contenus affichés sur votre site doivent être prêts à être partagés.", "Content shown on your website must be ready to share publicly.")}</p></div>
                </div>
                <ModulesEditor
                  modules={config.design.modules}
                  onChange={(modules) => update("design", { ...config.design, modules })}
                  onImage={(event) => void uploadDesignImage(event, "gallery")}
                  uploading={uploadingImage || busy}
                  language={config.language}
                  affiliation={config.affiliation}
                  firstName={config.firstName}
                  brandName={config.brandName}
                  architectureMode={config.architecture.mode}
                  siteContext={aiSiteContext}
                />

                <div className="section-kicker">
                  <span>02</span>
                  <div><b>{tr("Activité et identité", "Activity and identity")}</b><p>{tr("Les mentions MWR Life concernent uniquement les sites d’ambassadeurs.", "MWR Life disclosures only apply to ambassador websites.")}</p></div>
                </div>
                <Field label={tr("Votre activité", "Your activity")}>
                  <select value={config.affiliation} onChange={(event) => updateAffiliation(event.target.value as SiteConfig["affiliation"])}>
                    <option value="mwr">{tr("Ambassadeur indépendant MWR Life", "Independent MWR Life Ambassador")}</option>
                    <option value="independent">{tr("Autre activité indépendante", "Other independent activity")}</option>
                  </select>
                </Field>
                {config.affiliation === "mwr" ? <>
                  <div className="locked premium-locked">
                    <span>{tr("Mention d’indépendance maintenue", "Independence disclosure retained")}</span>
                    <p>{requiredDisclaimer}</p>
                  </div>
                  <p className="media-license-note">{tr("Les logos sont facultatifs. Activez uniquement les visuels que votre activité vous autorise à utiliser ; ils ne remplacent pas la mention d’indépendance.", "Logos are optional. Enable only visuals your activity permits you to use; they do not replace the independence disclosure.")}</p>
                  <div className="visibility-options-stack logo-visibility-options">
                    <VisibilityOption
                      checked={config.design.showMwrLogo}
                      title="Logo MWR Life « Independent Distributor »"
                      activeLabel={tr("Affiché", "Shown")}
                      inactiveLabel={tr("Masqué", "Hidden")}
                      description={config.design.showMwrLogo
                        ? tr("Le logo sera visible en bas du site avec la mention d’indépendance obligatoire.", "The logo will appear at the bottom of the website with the required independence disclosure.")
                        : tr("Le logo n’apparaît pas sur le site. La mention d’indépendance reste affichée.", "The logo does not appear on the website. The independence disclosure remains visible.")}
                      logo="/logos/mwr-life-independent.svg"
                      onChange={(checked) => update("design", { ...config.design, showMwrLogo: checked })}
                    />
                    <VisibilityOption
                      checked={config.design.showTravelAdvantageLogo}
                      title="Logo Travel Advantage « Independent Distributor »"
                      activeLabel={tr("Affiché", "Visible")}
                      inactiveLabel={tr("Masqué", "Hidden")}
                      description={config.design.showTravelAdvantageLogo
                        ? tr("Le logo sera visible en bas du site avec la mention d’indépendance obligatoire.", "The logo will appear in the footer with the required independence disclosure.")
                        : tr("Le logo n’apparaît pas sur le site. La mention d’indépendance reste affichée.", "The logo will not appear on the website. The independence disclosure remains visible.")}
                      logo="/logos/travel-advantage-independent.svg"
                      onChange={(checked) => update("design", { ...config.design, showTravelAdvantageLogo: checked })}
                    />
                  </div>
                </> : <div className="helper-card premium-helper-card">
                  <b>{tr("Site indépendant sans mention MWR Life", "Independent website without MWR Life disclosure")}</b>
                  <p>{tr("Les mentions automatiques et logos MWR Life et Travel Advantage seront absents. Les pages légales ci-dessous seront adaptées aux informations que vous renseignez.", "Automatic MWR Life and Travel Advantage disclosures and logos will be absent. The legal pages below will adapt to the information you provide.")}</p>
                </div>}

                <div className="section-kicker">
                  <span>03</span>
                  <div><b>{tr("Conformité du site", "Website compliance")}</b><p>{tr("Préparez automatiquement les pages légales et la transparence RGPD du site.", "Prepare legal pages and GDPR transparency information automatically.")}</p></div>
                </div>
                <ComplianceEditor
                  value={config.legal}
                  firstName={config.firstName}
                  lastName={config.lastName}
                  affiliation={config.affiliation}
                  onChange={(legal) => update("legal", legal)}
                />
              </>
            ) : null}

            {step === "review" ? (
              <>
                <div className="section-kicker">
                  <span>✓</span>
                  <div><b>{tr("Contrôle final", "Final review")}</b><p>{tr("Une dernière vérification avant de rendre le site accessible.", "One final check before making the website accessible.")}</p></div>
                </div>
                {errors.length ? (
                  <div className="error-card premium-error-card">
                    <b>{tr("À corriger avant publication", "Fix before publishing")}</b>
                    <ul>{errors.map((error) => (
                      <li key={error.message}>
                        <button type="button" className="review-error-link" onClick={() => {
                          setStep(error.step);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}>
                          {error.message} · {tr("Corriger dans", "Fix in")} « {locale === "en" ? steps.find((item) => item.key === error.step)?.labelEn : steps.find((item) => item.key === error.step)?.label} »
                        </button>
                      </li>
                    ))}</ul>
                  </div>
                ) : (
                  <div className="success-card premium-success-card review-success">
                    <div>
                      <b>{remoteMode ? tr("Contrôle qualité structurel réussi.", "Structural quality check passed.") : tr("Le site est prêt pour le prototype local.", "The website is ready for the local prototype.")}</b>
                      <p>
                        {remoteMode
                          ? tr("Identité, message, liens requis et conformité structurelle sont cohérents. Relisez l’aperçu visuel avant publication.", "Identity, message, required links and structural compliance are consistent. Review the visual preview before publishing.")
                          : tr("Configurez Supabase pour rendre cette publication accessible depuis un autre appareil.", "Configure Supabase to make this publication accessible from another device.")}
                      </p>
                    </div>
                  </div>
                )}

                <div className="quality-summary-card">
                  <div className="quality-summary-head">
                    <div><span className="mini">ELTARA QUALITY CHECK</span><strong>{qualityPassed}/{qualityChecks.length} {tr("contrôles réussis", "checks passed")}</strong></div>
                    <span className={qualityWarnings ? "quality-score warning" : "quality-score done"}>{qualityWarnings ? `${qualityWarnings} ${tr(qualityWarnings > 1 ? "améliorations" : "amélioration", qualityWarnings > 1 ? "improvements" : "improvement")}` : tr("Prêt ✓", "Ready ✓")}</span>
                  </div>
                  <div className="quality-check-list">
                    {qualityChecks.map((check) => <button type="button" key={check.label} className={`quality-check ${check.status}`} onClick={() => { setStep(check.step); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                      <span>{check.status === "pass" ? "✓" : "!"}</span>
                      <p><b>{check.label}</b><small>{check.detail}</small></p>
                      <i>{check.status === "pass" ? tr("Voir →", "View →") : tr("Corriger →", "Fix →")}</i>
                    </button>)}
                  </div>
                  <p className="quality-note">{tr("Les recommandations n’empêchent pas la publication. Les erreurs indispensables restent bloquantes au-dessus.", "Recommendations do not block publishing. Required errors above remain blocking.")}</p>
                </div>
                <div className="quality-summary-card">
                  <div className="quality-summary-head"><div><span className="mini">{tr("RELECTURE ÉDITORIALE", "EDITORIAL REVIEW")}</span><strong>{tr("Orthographe, grammaire et clarté", "Spelling, grammar and clarity")}</strong></div></div>
                  <p>{tr("Les contrôles automatiques ci-dessus vérifient la structure. Lancez une relecture IA pour obtenir des corrections de texte à accepter individuellement.", "The automated checks above verify structure. Run an AI editorial review to get copy corrections you can accept individually.")}</p>
                  <button type="button" className="secondary" disabled={reviewing || busy} onClick={() => void reviewWithAi()}>{reviewing ? tr("Relecture en cours…", "Reviewing…") : tr("Relire avec l’IA", "Review with AI")}</button>
                  {reviewResult ? <div role="status" aria-live="polite"><p>{reviewResult.issues.length ? `${reviewResult.issues.length} ${tr("suggestion(s) de rédaction", "writing suggestion(s)")}` : tr("Aucune correction éditoriale suggérée.", "No editorial correction suggested.")}</p>{reviewResult.issues.map((issue, index) => <div className="module-item" key={`${issue.field}-${index}`}><b>{reviewFieldLabels[issue.field] || issue.field} : {issue.reason}</b>{reviewResult.suggestions[issue.field] ? <><p><small>{tr("Texte actuel", "Current text")}</small><br />{currentReviewText(issue.field)}</p><p><small>{tr("Proposition", "Proposal")}</small><br />{reviewResult.suggestions[issue.field]}</p><button type="button" className="secondary" onClick={() => { update(issue.field, reviewResult.suggestions[issue.field] as never, true); setReviewResult((previous) => previous ? { ...previous, issues: previous.issues.filter((_, i) => i !== index) } : null); }}>{tr("Utiliser cette correction", "Use this correction")}</button></> : null}</div>)}</div> : null}
                </div>

                <div className="review-checklist">
                  <div className={config.firstName && config.lastName && config.brandName && config.slug ? "done" : ""}>
                    <span>{config.firstName && config.lastName && config.brandName && config.slug ? "✓" : "1"}</span>
                    <p><b>{tr("Identité", "Identity")}</b><small>{tr("Nom du site et adresse", "Website name and address")}</small></p>
                  </div>
                  <div className={config.heroTitle ? "done" : ""}>
                    <span>{config.heroTitle ? "✓" : "2"}</span>
                    <p><b>{tr("Message", "Message")}</b><small>{tr("Titre principal", "Main headline")}</small></p>
                  </div>
                  <div className={config.bookingUrl ? "done" : "optional"}>
                    <span>{config.bookingUrl ? "✓" : "○"}</span>
                    <p><b>{tr("Rendez-vous", "Booking")}</b><small>{config.bookingUrl ? tr("Lien ajouté", "Link added") : tr("Facultatif", "Optional")}</small></p>
                  </div>
                  <div className={config.affiliation === "mwr" ? "done" : "optional"}>
                    <span>{config.affiliation === "mwr" ? "✓" : "○"}</span>
                    <p><b>{tr("Activité", "Activity")}</b><small>{config.affiliation === "mwr" ? tr("Mention d’indépendance affichée", "Independence disclosure shown") : tr("Mentions légales à vérifier", "Legal notice to verify")}</small></p>
                  </div>
                </div>

                <div className="publish-summary premium-publish-summary">
                  <div><span>{tr("Lien du site après publication", "Website link after publishing")}</span><strong>{betaPublicUrl}</strong></div>
                  <div><span>{tr("Langue", "Language")}</span><strong>{config.language === "both" ? tr("Français (bilingue à venir)", "French (bilingual coming soon)") : config.language.toUpperCase()}</strong></div>
                  <div><span>{tr("Stockage", "Storage")}</span><strong>{remoteMode ? "Supabase Cloud" : tr("Navigateur local", "Local browser")}</strong></div>
                  <div><span>{tr("État", "Status")}</span><strong>{published ? tr("Publié", "Published") : tr("Prêt à publier", "Ready to publish")}</strong></div>
                </div>

                <button
                  type="button"
                  className="primary publish-button premium-publish-button"
                  disabled={errors.length > 0 || busy}
                  onClick={publish}
                >
                  {busy ? tr("Publication…", "Publishing…") : published ? tr("Republier les modifications", "Republish changes") : tr("Publier le site", "Publish website")}
                  {!busy ? <span aria-hidden="true">→</span> : null}
                </button>
                {published ? (
                  <div className="published-share-card" aria-live="polite">
                    <div>
                      <span className="mini">{tr("Lien bêta partageable", "Shareable beta link")}</span>
                      <strong>{betaPublicUrl}</strong>
                      <p>{tr("Ce lien fonctionne dès maintenant. Le sous-domaine personnalisé sera activé dans une étape ultérieure.", "This link works now. The custom subdomain will be activated at a later step.")}</p>
                    </div>
                    <div className="published-share-actions">
                      <Link className="button secondary" href={publicPath} target="_blank">{tr("Ouvrir", "Open")} ↗</Link>
                      <button type="button" className="button primary" onClick={copyPublicUrl}>
                        {copyState === "copied" ? tr("✓ Lien copié", "✓ Link copied") : copyState === "error" ? tr("Copie impossible", "Unable to copy") : tr("Copier le lien", "Copy link")}
                      </button>
                    </div>
                  </div>
                ) : null}
                {published && remoteMode ? (
                  <div className={"post-publish-health " + (postPublishHealth?.overall || postPublishHealthState)} aria-live="polite">
                    <div className="post-publish-health-head">
                      <div>
                        <span className="mini">{tr("DIAGNOSTIC APRÈS PUBLICATION", "POST-PUBLISH DIAGNOSTIC")}</span>
                        <strong>
                          {postPublishHealthState === "checking"
                            ? tr("Vérification du site public…", "Checking the public website…")
                            : postPublishHealthState === "error"
                              ? tr("Diagnostic temporairement indisponible", "Diagnostic temporarily unavailable")
                              : postPublishHealth?.overall === "healthy"
                                ? tr("Site public sain", "Public website healthy")
                                : postPublishHealth?.overall === "incident"
                                  ? tr("Une intervention est nécessaire", "An intervention is required")
                                  : postPublishHealth
                                    ? tr("Une amélioration est recommandée", "An improvement is recommended")
                                    : tr("Diagnostic prêt à être lancé", "Diagnostic ready")}
                        </strong>
                      </div>
                      {postPublishHealth ? (
                        <span className={"health-status-badge " + postPublishHealth.overall}>
                          {postPublishHealth.overall === "healthy"
                            ? tr("Sain", "Healthy")
                            : postPublishHealth.overall === "incident"
                              ? tr("Incident", "Incident")
                              : tr("À corriger", "Action")}
                        </span>
                      ) : null}
                    </div>
                    {postPublishHealth ? (
                      <>
                        <ul className="post-publish-health-checks">
                          {postPublishHealth.checks.map((check) => {
                            const display = supportCheckDisplay(check, locale);
                            return (
                              <li key={check.key} className={check.status}>
                                <span aria-hidden="true">{check.status === "healthy" ? "✓" : check.status === "incident" ? "×" : "!"}</span>
                                <div><b>{display.title}</b><small>{display.detail}</small></div>
                              </li>
                            );
                          })}
                        </ul>
                        <div className="actions">
                          {postPublishHealth.clientAction ? (
                            <Link className="button primary" href="/support">{tr("Corriger avec le Health Center", "Fix with Health Center")}</Link>
                          ) : postPublishHealth.overall !== "healthy" ? (
                            <Link className="button secondary" href="/support">{tr("Ouvrir le Health Center", "Open Health Center")}</Link>
                          ) : null}
                          <button type="button" className="button secondary" onClick={async () => {
                            const supabase = getSupabaseBrowserClient();
                            const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
                            if (data.session?.access_token && remoteSiteId) {
                              void runPostPublishHealth(remoteSiteId, data.session.access_token);
                            }
                          }}>
                            {tr("Relancer le diagnostic", "Run diagnostic again")}
                          </button>
                        </div>
                      </>
                    ) : postPublishHealthState === "error" ? (
                      <div className="actions">
                        <Link className="button secondary" href="/support">{tr("Ouvrir le Health Center", "Open Health Center")}</Link>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>

          <div className="builder-actions premium-builder-actions">
            <button type="button" className="secondary" disabled={stepIndex === 0 || busy} onClick={() => go(-1)}>
              ← {tr("Retour", "Back")}
            </button>
            <button type="button" className="secondary save-button" disabled={busy} onClick={save}>
              {saved && !busy ? tr("✓ Sauvegardé", "✓ Saved") : tr("Sauvegarder", "Save")}
            </button>
            {stepIndex < steps.length - 1 ? (
              <button type="button" className="primary premium-button" disabled={busy} onClick={() => go(1)}>
                {tr("Continuer", "Continue")}: {nextStepLabel} <span aria-hidden="true">→</span>
              </button>
            ) : null}
          </div>
        </section>

        <aside className="preview-wrap builder-preview premium-builder-preview">
          <div className="panel-heading preview-panel-heading">
            <div>
              <p className="step">{tr("Aperçu live", "Live preview")}</p>
              <h2>{config.brandName}</h2>
            </div>
            <div className="preview-heading-actions">
              <div className="preview-device-switch" aria-label={tr("Format de l’aperçu", "Preview format")}>
                <button type="button" className={previewDevice === "desktop" ? "active" : ""} aria-pressed={previewDevice === "desktop"} onClick={() => setPreviewDevice("desktop")}>{tr("Ordinateur", "Desktop")}</button>
                <button type="button" className={previewDevice === "mobile" ? "active" : ""} aria-pressed={previewDevice === "mobile"} onClick={() => setPreviewDevice("mobile")}>Mobile</button>
              </div>
              <Link href="/preview">{tr("Plein écran", "Full screen")} ↗</Link>
            </div>
          </div>
          <div className={`preview-device-frame ${previewDevice === "mobile" ? "is-mobile" : "is-desktop"}`}>
            <div className="device-dots"><i /><i /><i /></div>
            <SitePreview config={config} compact />
          </div>
          <div className="preview-note">
            <span>✦</span>
            <p>{previewDevice === "mobile" ? tr("Aperçu mobile simulé : vérifiez notamment le cadrage de la photo, la longueur des titres et les boutons.", "Simulated mobile preview: check photo cropping, title length and buttons in particular.") : tr("Vous voyez le résultat en direct. Rien n’est public avant l’étape « Publication ».", "You are seeing the result live. Nothing is public before the Publish step.")}</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
