"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
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
import { LanguageSwitch, useUiLanguage } from "../../components/LanguageProvider";
import {
  defaultSiteConfig,
  requiredDisclaimer,
  type SiteConfig,
  type SiteLanguage
} from "../../lib/site-config";
import { loadDraft, publishDraft, saveDraft } from "../../lib/site-store";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../../lib/supabase-browser";
import { freeEntitlements, getMySiteEntitlements, type SubscriptionEntitlements } from "../../lib/subscription";
import { optimizeBackgroundImage, optimizeImage } from "../../lib/optimize-image";
import { contrastRatio, surfaceInk } from "../../lib/site-design";
import { legalMissingFields } from "../../lib/site-legal";
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

const stepDefinitions = [
  {
    key: "identity",
    label: { fr: "Identité", en: "Identity" },
    eyebrow: { fr: "Votre base", en: "Your foundation" },
    description: { fr: "Nom, adresse, langue et photo : les éléments qui rendent le site immédiatement personnel.", en: "Name, address, language and photo: the elements that immediately make the website yours." },
    time: "2 min",
    guidance: { fr: "Commencez simplement par votre prénom et votre nom. Le nom du site et son adresse se préremplissent automatiquement.", en: "Start with your first and last name. The website name and address are pre-filled automatically." }
  },
  {
    key: "story",
    label: { fr: "Message", en: "Message" },
    eyebrow: { fr: "Votre voix", en: "Your voice" },
    description: { fr: "Le titre, l'introduction et votre présentation. Le ton reste simple, humain et fidèle à vous.", en: "Your headline, introduction and presentation, with a simple and human tone that sounds like you." },
    time: "4 min",
    guidance: { fr: "Écrivez comme si vous expliquiez votre démarche à une connaissance. Quelques phrases naturelles suffisent.", en: "Write as if you were explaining your approach to someone you know. A few natural sentences are enough." }
  },
  {
    key: "design",
    label: { fr: "Style", en: "Style" },
    eyebrow: { fr: "Votre ambiance", en: "Your look & feel" },
    description: { fr: "Couleurs, motifs, images et sons pour donner une identité personnelle à votre site.", en: "Colors, patterns, images and audio to give your website a distinctive identity." },
    time: "5 min",
    guidance: { fr: "Commencez par une couleur et un motif. Vous pouvez rechercher une image ou un son, puis revenir changer vos choix plus tard.", en: "Start with a color and a pattern. You can add an image or audio and change your choices later." }
  },
  {
    key: "booking",
    label: { fr: "Rendez-vous", en: "Booking" },
    eyebrow: { fr: "Passer à l'action", en: "Turn visits into action" },
    description: { fr: "Reliez votre agenda et vos réseaux pour transformer la visite en échange concret.", en: "Connect your booking page and social profiles to turn visits into real conversations." },
    time: "2 min",
    guidance: { fr: "Copiez l'adresse de votre page de réservation, puis collez-la ci-dessous. Vous pouvez aussi passer cette étape et y revenir plus tard.", en: "Copy your booking page address and paste it below. You can also skip this step and come back later." }
  },
  {
    key: "options",
    label: { fr: "Options", en: "Options" },
    eyebrow: { fr: "Votre contenu", en: "Your content" },
    description: { fr: "Configurez les rubriques facultatives, leur contenu et leur ordre d'affichage.", en: "Configure optional sections, their content and display order." },
    time: "2 min",
    guidance: { fr: "Activez uniquement les rubriques utiles. Elles restent masquées tant qu'elles ne contiennent pas de contenu publiable.", en: "Enable only useful sections. They stay hidden until they contain publishable content." }
  },
  {
    key: "review",
    label: { fr: "Publication", en: "Publish" },
    eyebrow: { fr: "Dernière vérification", en: "Final review" },
    description: { fr: "Contrôlez l'adresse, la langue et les informations essentielles avant la mise en ligne.", en: "Review the address, language and essential information before going live." },
    time: "1 min",
    guidance: { fr: "Relisez le résumé. Si tout est vert, vous pouvez publier puis partager votre lien.", en: "Review the summary. If everything is green, you can publish and share your link." }
  }
] as const;

type StepKey = (typeof stepDefinitions)[number]["key"];

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
  activeLabel = "Actif",
  inactiveLabel = "Masqué",
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
          <em>{checked ? activeLabel : inactiveLabel}</em>
        </span>
        <small>{description}</small>
      </span>
      {logo ? <img className="visibility-option-logo" src={logo} alt="" aria-hidden="true" /> : null}
    </label>
  );
}

export default function BuilderPage() {
  const router = useRouter();
  const { locale } = useUiLanguage();
  const en = locale === "en";
  const steps = stepDefinitions.map((item) => ({
    ...item,
    label: item.label[locale],
    eyebrow: item.eyebrow[locale],
    description: item.description[locale],
    guidance: item.guidance[locale]
  }));
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
  const [userEmail, setUserEmail] = useState("");
  const [origin, setOrigin] = useState("");
  const [verifiedPublicUrl, setVerifiedPublicUrl] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
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
      return;
    }
    let cancelled = false;
    void getMySiteEntitlements(remoteSiteId)
      .then((entitlements) => {
        if (!cancelled) setSiteEntitlements(entitlements);
      })
      .catch(() => {
        if (!cancelled) setSiteEntitlements(freeEntitlements);
      });
    return () => {
      cancelled = true;
    };
  }, [remoteMode, remoteSiteId]);

  const premiumArchitectAvailable =
    siteEntitlements.premiumArchitect &&
    ["active", "trialing"].includes(siteEntitlements.status);
  const premiumAccessHref =
    ["past_due", "canceled", "suspended"].includes(siteEntitlements.status)
      ? "/billing"
      : "/plans";
  const premiumAccessLabel =
    premiumAccessHref === "/billing" ? (en ? "Restore my access" : "Régulariser mon accès") : (en ? "View Pro plan" : "Voir l’offre Pro");

  useEffect(() => {
    if (!ready || !remoteMode) return;
    const eventByStep: Partial<Record<StepKey, "step_identity"|"step_story"|"step_booking"|"step_review">> = { identity:"step_identity", story:"step_story", booking:"step_booking", review:"step_review" };
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
      }).catch((error) => setSyncError(error instanceof Error ? error.message : en ? "Automatic save failed." : "Sauvegarde automatique impossible."));
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [config, changeVersion, ready, remoteMode, remoteSiteId]);

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
  const currentStep = steps[stepIndex];
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
    const neutralIntro = en ? "Present your activity, your approach and what visitors can discover with you." : "Présentez votre activité, votre approche et ce que vos visiteurs peuvent découvrir avec vous.";
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
    stepIndex < steps.length - 1 ? steps[stepIndex + 1].label : "";

  const createGuidedDraft = async () => {
    const hasPersonalizedText =
      config.heroTitle !== defaultSiteConfig.heroTitle ||
      config.heroSubtitle !== defaultSiteConfig.heroSubtitle ||
      config.aboutText !== defaultSiteConfig.aboutText;
    if (hasPersonalizedText && !window.confirm(
      en ? "The current copy will be replaced by the new proposal. Continue?" : "Les textes actuels seront remplacés par la nouvelle proposition. Voulez-vous continuer ?"
    )) return;

    setBusy(true);
    setSyncError("");
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error(en ? "The AI assistant requires an active connection." : "L'assistant IA nécessite une connexion au site.");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error(en ? "Sign in again to prepare your copy with AI." : "Reconnectez-vous pour préparer vos textes avec l'IA.");

      const response = await fetch("/api/ai/write", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
      if (!response.ok || !data?.draft) throw new Error(data?.error || en ? "The copy could not be prepared." : "Impossible de préparer les textes.");

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
      setSyncError(error instanceof Error ? error.message : en ? "The copy could not be prepared." : "Impossible de préparer les textes.");
    } finally {
      setBusy(false);
    }
  };

  const createSiteWithAi = async (extraBrief = "") => {
    if (!premiumArchitectAvailable) {
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
      if (!supabase) throw new Error(en ? "Full AI website creation requires an active connection." : "La création complète par IA nécessite une connexion.");
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) throw new Error(en ? "Sign in again to use full AI website creation." : "Reconnectez-vous pour utiliser la création complète par IA.");
      const architectSiteId = remoteSiteId || (await saveMySite(config, false)).id;
      if (!remoteSiteId) setRemoteSiteId(architectSiteId);
      const response = await fetch("/api/ai/write", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
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
      if (!response.ok || !result?.proposal) throw new Error(result?.error || en ? "The complete website could not be prepared." : "Impossible de préparer le site complet.");
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
      setSyncError(error instanceof Error ? error.message : en ? "The complete website could not be prepared." : "Impossible de préparer le site complet.");
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
          : en ? "Your feedback could not be saved." : "Votre évaluation n’a pas pu être enregistrée."
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
    if (!premiumArchitectAvailable) {
      router.push(premiumAccessHref);
      return;
    }
    if (!revisionRequest.trim()) return;
    setRevisionLoading(true);
    setSyncError("");
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error(en ? "Global revision requires an active connection." : "La révision globale nécessite une connexion.");
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) throw new Error(en ? "Sign in again to use global revision." : "Reconnectez-vous pour utiliser la révision globale.");
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
      const response = await fetch("/api/ai/write", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({
        field: "siteRevision", siteId: revisionSiteId, instruction: revisionRequest,
        context: { language: config.language, affiliation: config.affiliation, firstName: config.firstName, brandName: config.brandName, revisionRequest, existingProposal, contentLibrary: config.contentLibrary.assets.map((asset) => ({ id: asset.id, kind: asset.kind, name: asset.name, rights: asset.rights, publishable: asset.publishable, notes: asset.notes })), siteContext: aiSiteContext }
      }) });
      const result = await response.json();
      if (!response.ok || !result?.proposal) throw new Error(result?.error || en ? "This revision could not be prepared." : "Impossible de préparer cette révision.");
      setRevisionProposal(result.proposal);
    } catch (error) { setSyncError(error instanceof Error ? error.message : en ? "This revision could not be prepared." : "Impossible de préparer cette révision."); }
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
      changes.push("Présentation");
    }

    if (revisionProposal.bookingLabel !== config.bookingLabel) {
      changes.push("Bouton de rendez-vous");
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
      changes.push("Rubriques");
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
    checks.push({ label: "Identité complète", detail: config.firstName.trim() && config.lastName.trim() && config.brandName.trim() ? "Nom et identité du site renseignés." : "Complétez l’identité du site.", status: config.firstName.trim() && config.lastName.trim() && config.brandName.trim() ? "pass" : "warn", step: "identity" });
    checks.push({ label: "Message d’accueil", detail: config.heroTitle.trim() && words(config.heroSubtitle) >= 6 ? "Titre et introduction suffisamment renseignés." : "Ajoutez un titre et une introduction plus complète.", status: config.heroTitle.trim() && words(config.heroSubtitle) >= 6 ? "pass" : "warn", step: "story" });
    checks.push({ label: "Présentation personnelle", detail: words(config.aboutText) >= 25 ? "La présentation apporte assez de contexte." : "La présentation gagnerait à être un peu plus développée.", status: words(config.aboutText) >= 25 ? "pass" : "warn", step: "story" });
    const bookingLabelLength = config.bookingLabel.trim().length;
    const ctaOk = !config.design.showBooking || !config.bookingUrl.trim() || (bookingLabelLength >= 3 && bookingLabelLength <= 60);
    checks.push({ label: "Appel à l’action", detail: ctaOk ? "Le rendez-vous et le libellé du bouton sont cohérents." : "Utilisez un libellé de bouton clair et concis, entre 3 et 60 caractères.", status: ctaOk ? "pass" : "warn", step: "booking" });
    const socialOk = (!config.design.showInstagram || validOptionalUrl(config.instagramUrl)) && (!config.design.showFacebook || validOptionalUrl(config.facebookUrl));
    checks.push({ label: "Liens externes", detail: socialOk && (!config.design.showBooking || bookingLinkStatus !== "invalid") ? "Les liens affichés ont un format valide." : "Au moins un lien affiché doit être vérifié.", status: socialOk && (!config.design.showBooking || bookingLinkStatus !== "invalid") ? "pass" : "warn", step: "booking" });
    const mediaOk = Boolean(config.profileImageUrl || config.design.heroImage || config.design.backgroundPhotoUrl);
    checks.push({ label: "Qualité visuelle", detail: mediaOk ? "Au moins un visuel personnel ou principal est présent." : "Ajoutez une photo ou une image principale pour renforcer l’impact visuel.", status: mediaOk ? "pass" : "warn", step: "design" });
    const portraitOk = !config.design.showPortrait || Boolean(config.profileImageUrl);
    checks.push({ label: "Photo de profil", detail: portraitOk ? (config.design.showPortrait ? "Le portrait affiché dispose d’une photo." : "Le portrait est volontairement masqué.") : "Le portrait est activé sans photo : les initiales seront affichées. Ajoutez une photo ou masquez le portrait.", status: portraitOk ? "pass" : "warn", step: "identity" });
    checks.push({ label: "Conformité activité", detail: config.affiliation === "mwr" ? "La mention d’indépendance obligatoire sera affichée." : "Le profil d’activité indépendant est appliqué.", status: "pass", step: "options" });
    const legalMissing = legalMissingFields(config.legal, config.firstName, config.lastName);
    checks.push({
      label: "Mentions légales & RGPD",
      detail: legalMissing.length ? `À compléter : ${legalMissing.slice(0, 4).join(", ")}${legalMissing.length > 4 ? "…" : ""}` : "Les informations nécessaires aux pages Mentions légales, Confidentialité et Cookies sont renseignées.",
      status: legalMissing.length ? "warn" : "pass",
      step: "options"
    });
    const { surface, ink } = surfaceInk(config.design);
    checks.push({ label: "Lisibilité des rubriques", detail: `Contraste du fond et du texte : ${contrastRatio(surface, ink).toFixed(1)}:1.`, status: contrastRatio(surface, ink) >= 4.5 ? "pass" : "warn", step: "design" });
    checks.push({ label: "Contraste du bouton", detail: `Texte du bouton adapté à la couleur choisie (${contrastRatio(config.design.accent, surfaceInk({ ...config.design, customBackgroundColor: config.design.accent }).ink).toFixed(1)}:1).`, status: "pass", step: "design" });
    const allText = [config.heroTagline, config.heroTitle, config.heroSubtitle, config.aboutHeading, config.aboutText].filter((value) => value.trim());
    const normalized = allText.map((value) => value.trim().toLowerCase().replace(/[.!?]+$/, ""));
    checks.push({ label: "Répétitions évidentes", detail: new Set(normalized).size === normalized.length ? "Aucun texte identique entre les champs principaux." : "Deux champs contiennent le même texte : diversifiez-les.", status: new Set(normalized).size === normalized.length ? "pass" : "warn", step: "story" });
    const placeholders = /lorem ipsum|votre texte ici|exemple de texte|texte à compléter/i.test(allText.join(" "));
    checks.push({ label: "Texte à compléter", detail: placeholders ? "Un texte de démonstration semble encore présent." : "Aucun texte de démonstration connu détecté.", status: placeholders ? "warn" : "pass", step: "story" });
    const responsiveTextOk = config.heroTitle.trim().length <= 90
      && config.heroSubtitle.trim().length <= 320
      && config.brandName.trim().length <= 70
      && (!config.design.showBooking || config.bookingLabel.trim().length <= 60);
    checks.push({ label: "Responsive du contenu", detail: responsiveTextOk ? "Les longueurs principales restent adaptées aux petits écrans." : "Un titre, une introduction, le nom du site ou le CTA est trop long pour un affichage mobile confortable.", status: responsiveTextOk ? "pass" : "warn", step: "story" });
    const focusOk = !config.design.backgroundPhotoUrl
      || (config.design.backgroundPositionX >= 10 && config.design.backgroundPositionX <= 90 && config.design.backgroundPositionY >= 10 && config.design.backgroundPositionY <= 85);
    checks.push({ label: "Cadrage mobile", detail: focusOk ? "Le point focal de la photo reste dans une zone sûre pour le recadrage cover." : "Le point focal est très proche d’un bord : vérifiez le rendu sur mobile.", status: focusOk ? "pass" : "warn", step: "design" });
    const unknownRights = config.contentLibrary.assets.filter((asset) => asset.rights === "unknown");
    const publishableMissing = config.contentLibrary.assets.filter((asset) => asset.publishable && ((asset.kind !== "text" && (!asset.url || asset.url.startsWith("private://"))) || (asset.kind === "text" && !asset.text.trim())));
    const rightsSourceMissing = config.contentLibrary.assets.filter((asset) => (asset.rights === "licensed" || asset.rights === "public-domain") && !asset.sourceUrl.trim());
    checks.push({ label: "Droits des contenus", detail: unknownRights.length ? `${unknownRights.length} contenu(s) ont des droits à vérifier et restent exclus de la publication.` : rightsSourceMissing.length ? `${rightsSourceMissing.length} contenu(s) sous licence ou domaine public nécessitent encore une source vérifiable.` : "Les contenus fournis ont un statut de droits explicite et les sources requises.", status: unknownRights.length || rightsSourceMissing.length ? "warn" : "pass", step: "story" });
    checks.push({ label: "Bibliothèque de contenus", detail: publishableMissing.length ? "Un contenu autorisé à la publication ne possède pas encore de fichier exploitable." : "Les contenus publiables disposent des informations nécessaires.", status: publishableMissing.length ? "warn" : "pass", step: "story" });
    const enabledPages = config.architecture.pages.filter((page) => page.enabled);
    const pageSlugs = enabledPages.map((page) => page.slug);
    const clearedAssetIds = new Set(config.contentLibrary.assets.filter((asset) => asset.publishable && asset.rights !== "unknown").map((asset) => asset.id));
    const invalidAssignments = enabledPages.flatMap((page) => page.assetIds || []).filter((id) => !clearedAssetIds.has(id));
    const architectureOk = enabledPages.some((page) => page.kind === "home") && new Set(pageSlugs).size === pageSlugs.length && (config.architecture.mode === "single" || enabledPages.length > 1);
    checks.push({ label: "Affectation des contenus", detail: invalidAssignments.length ? "Une page référence un contenu non autorisé ou aux droits non validés." : "Les contenus affectés aux pages sont autorisés à la publication.", status: invalidAssignments.length ? "warn" : "pass", step: "story" });
    checks.push({ label: "Architecture du site", detail: architectureOk ? `${enabledPages.length} page(s), hiérarchie et URLs cohérentes.` : "La structure des pages contient une incohérence à corriger.", status: architectureOk ? "pass" : "warn", step: "story" });
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
    if (modules.gallery.enabled && modules.gallery.images.length === 0) moduleProblems.push("galerie");
    if (modules.faq.enabled && !modules.faq.items.some((item) => item.question.trim() && item.answer.trim())) moduleProblems.push("FAQ");
    if (modules.testimonials.enabled && !modules.testimonials.items.some((item) => item.quote.trim() && item.author.trim())) moduleProblems.push("témoignages");
    if (modules.contact.enabled && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(modules.contact.email)) moduleProblems.push("contact");
    if (modules.video.enabled && !validYoutubeUrl(modules.video.url)) moduleProblems.push("vidéo");
    if (modules.figures.enabled && !modules.figures.items.some((item) => item.value.trim() && item.label.trim())) moduleProblems.push("chiffres clés");
    if (modules.benefits.enabled && !modules.benefits.items.some((item) => item.title.trim() && item.text.trim())) moduleProblems.push("avantages");
    const moduleReady = moduleProblems.length === 0;
    checks.push({ label: "Modules activés", detail: moduleReady ? "Les rubriques activées ont du contenu publiable." : `À compléter : ${moduleProblems.join(", ")}.`, status: moduleReady ? "pass" : "warn", step: "options" });
    const galleryAccessible = !modules.gallery.enabled || modules.gallery.images.length === 0 || modules.gallery.images.every((image) => image.caption.trim().length >= 3);
    checks.push({ label: "Images accessibles", detail: galleryAccessible ? "Les images de galerie ont une légende exploitable comme description." : "Ajoutez une légende descriptive aux images de galerie pour améliorer compréhension et accessibilité.", status: galleryAccessible ? "pass" : "warn", step: "options" });
    const sentences = [config.heroSubtitle, config.aboutText].filter(Boolean);
    const punctuation = sentences.every((text) => /[.!?…]$/.test(text.trim()));
    checks.push({ label: "Ponctuation", detail: punctuation ? "Les paragraphes principaux se terminent correctement." : "Vérifiez la ponctuation de l’introduction et de la présentation.", status: punctuation ? "pass" : "warn", step: "story" });
    const editorialReviewOk = reviewResult !== null && reviewResult.issues.length === 0;
    checks.push({
      label: "Relecture éditoriale IA",
      detail: reviewResult === null
        ? "La relecture orthographe, grammaire et cohérence n’a pas encore été lancée."
        : reviewResult.issues.length
          ? `${reviewResult.issues.length} suggestion(s) restent à examiner avant publication.`
          : "Orthographe, grammaire, cohérence et clarté ont été relues sans correction restante.",
      status: editorialReviewOk ? "pass" : "warn",
      step: "review"
    });
    return checks;
  }, [config, bookingLinkStatus, reviewResult]);

  const qualityPassed = qualityChecks.filter((check) => check.status === "pass").length;
  const qualityWarnings = qualityChecks.length - qualityPassed;
  const reviewFieldLabels: Partial<Record<keyof SiteConfig, string>> = {
    heroTagline: "Accroche",
    heroTitle: "Titre principal",
    heroSubtitle: "Introduction",
    aboutHeading: "Titre de présentation",
    aboutText: "Présentation",
    bookingLabel: "Bouton de rendez-vous"
  };
  const currentReviewText = (field: keyof SiteConfig) => {
    const value = config[field];
    return typeof value === "string" ? value : "";
  };

  const errors = useMemo(() => {
    const next: { message: string; step: StepKey }[] = [];
    if (!config.firstName.trim()) next.push({ message: "Prénom manquant", step: "identity" });
    if (!config.lastName.trim()) next.push({ message: "Nom manquant", step: "identity" });
    if (!config.brandName.trim()) next.push({ message: "Nom du site manquant", step: "identity" });
    if (!config.slug.trim()) next.push({ message: "Adresse du site manquante", step: "identity" });
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(config.slug)) next.push({ message: "Adresse du site invalide", step: "identity" });
    if (!config.heroTitle.trim()) next.push({ message: "Titre principal manquant", step: "story" });
    if (config.design.showBooking && bookingLinkStatus === "invalid") {
      next.push({ message: "Lien de rendez-vous invalide", step: "booking" });
    }
    if (config.affiliation === "independent" && /\b(mwr\s*life|travel\s*advantage)\b/i.test([config.heroTitle, config.heroSubtitle, config.aboutText, config.brandName, JSON.stringify(config.design.modules)].join(" "))) {
      next.push({ message: "Les textes citent MWR Life ou Travel Advantage : choisissez l’activité correspondante ou retirez ces références", step: "options" });
    }
    const missingLegal = legalMissingFields(config.legal, config.firstName, config.lastName);
    if (missingLegal.length) {
      next.push({ message: `Informations légales à compléter : ${missingLegal.slice(0, 3).join(", ")}${missingLegal.length > 3 ? "…" : ""}`, step: "options" });
    }
    return next;
  }, [config, bookingLinkStatus]);

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
      setSyncError(error instanceof Error ? error.message : en ? "Save failed." : "Erreur de sauvegarde.");
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
      if (remoteMode) {
        const supabase = getSupabaseBrowserClient();
        const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
        if (!data.session?.access_token) throw new Error("Reconnectez-vous pour publier.");
        const site = remoteSiteId ? { id: remoteSiteId } : await saveMySite(config, false, remoteSiteId || undefined);
        publishedSiteId = site.id;
        setRemoteSiteId(site.id);
        const promotedAssets = await Promise.all(config.contentLibrary.assets.map(async (asset) => {
          if (!asset.publishable || asset.kind === "text" || !asset.url.startsWith("private://")) return asset;
          const response = await fetch("/api/media/promote", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
            body: JSON.stringify({ siteId: site.id, privateRef: asset.url, assetId: asset.id, rights: asset.rights, sourceUrl: asset.sourceUrl })
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || en ? "A media asset could not be prepared for publishing." : "Impossible de préparer un média pour la publication.");
          return { ...asset, url: result.url };
        }));
        publishConfig = { ...config, contentLibrary: { assets: promotedAssets } };
        const remote = await saveMySite(publishConfig, true, publishedSiteId || undefined);
        publishedSiteId = remote.id;
        setRemoteSiteId(remote.id);
        setConfig(publishConfig);
        await refreshVerifiedPublicUrl(remote.id);
      }
      publishDraft(publishConfig);
      setSaved(true);
      setPublished(true);
      void trackProductEvent("publish_success", publishedSiteId);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : en ? "Publishing failed." : "Erreur de publication.");
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
      if (!data.session?.access_token) throw new Error(en ? "Sign in again to run the AI review." : "Reconnectez-vous pour lancer la relecture IA.");
      const response = await fetch("/api/ai/write", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ field: "qualityReview", instruction: "Relis les textes du site et propose uniquement des corrections utiles.", context: { language: config.language, affiliation: config.affiliation, firstName: config.firstName, brandName: config.brandName, siteContext: { ...aiSiteContext, bookingLabel: config.bookingLabel } } })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Relecture indisponible.");
      setReviewResult(result);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Relecture indisponible.");
    } finally { setReviewing(false); }
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
      setSyncError(en ? "This image is larger than 8 MB. Choose a smaller file before uploading." : "Cette image dépasse 8 Mo. Choisissez une photo plus légère avant l’envoi.");
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
      setSyncError(error instanceof Error ? error.message : "Impossible d'envoyer la photo.");
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
      if (!remoteMode) throw new Error("Connectez le stockage du site avant d'importer une photo.");
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
      setSyncError(error instanceof Error ? error.message : "Impossible d'envoyer l'image.");
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
            <small>Prototype 0.10</small>
          </span>
        </Link>

        <div className="progress premium-progress" aria-label={"Progression " + completion + "%"}>
          <span style={{ width: completion + "%" }} />
        </div>

        <div className="topbar-account premium-topbar-account">
          {ownedSites.length>1?<select aria-label={en ? "Active website" : "Site actif"} value={remoteSiteId||""} onChange={async e=>{
            const next=await getMySite(e.target.value);
            if(!next)return;
            if(next.privacyState==="erasure_requested"){router.push("/data");return;}
            setRemoteSiteId(next.id);setConfig(next.config);setPublished(next.status==="published");setSaved(true);
            await refreshVerifiedPublicUrl(next.id);
          }}>{ownedSites.map(site=><option key={site.id} value={site.id}>{site.slug}</option>)}</select>:null}
          <Link className="preview-shortcut" href="/preview">{en ? "Preview" : "Aperçu"}</Link>
          <span className={"cloud-pill " + (remoteMode ? "online" : "local")}>
            <i />{remoteMode ? "Cloud" : "Local"} · {completion}%
          </span>
          {userEmail ? <Link href="/plans" className="button secondary">{en ? "My plan" : "Mon offre"}</Link> : null}
          {userEmail ? <Link href="/domains" className="button secondary">{en ? "Domains" : "Domaines"}</Link> : null}
          {userEmail ? <Link href="/data" className="button secondary">{en ? "My data" : "Mes données"}</Link> : null}
          {userEmail ? <Link href="/feedback" className="button secondary">{en ? "Share feedback" : "Donner mon avis"}</Link> : null}
          {userEmail ? (
            <button type="button" className="account-button" onClick={logout} title={userEmail}>
              <span>{userEmail.charAt(0).toUpperCase()}</span>
              <b>{en ? "Sign out" : "Déconnexion"}</b>
            </button>
          ) : null}
        </div>
      </header>

      <div className="builder-layout premium-builder-layout">
        <aside className="step-nav premium-step-nav">
          <div className="step-nav-heading">
            <div className="builder-heading-row"><p className="eyebrow">{en ? "Your journey" : "Votre parcours"}</p><LanguageSwitch compact /></div>
            <h2>Construire le site</h2>
            <p>{en ? "Move forward step by step. You can return to any section at any time." : "Avancez étape par étape. Vous pouvez revenir sur chaque section à tout moment."}</p>
            <div className="beginner-promise">
              <span>✓</span>
              <p>{en ? "No technical skills needed: answer the questions and the Builder handles the rest." : "Pas besoin de compétences techniques : remplissez simplement les questions, nous nous occupons du reste."}</p>
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
            <span>{en ? "Website" : "Site"}</span>
            <strong>{config.brandName || "Nouveau site"}</strong>
            <small>{config.slug ? publicPath : (en ? "Address not set" : "Adresse à définir")}</small>
          </div>
        </aside>

        <section className="panel editor builder-panel premium-builder-panel">
          <div className="panel-heading premium-panel-heading">
            <div className="step-copy">
              <p className="step">{en ? "Step" : "Étape"} {stepIndex + 1} {en ? "of" : "sur"} {steps.length} · {currentStep.eyebrow}</p>
              <h1>{currentStep.label}</h1>
              <p className="step-description">{currentStep.description}</p>
            </div>
            <span aria-live="polite" className={"status premium-status " + (published ? "published" : saved ? "saved" : "draft")}>
              <i />
              {busy ? (en ? "Syncing…" : "Synchronisation…") : published ? (en ? "Published" : "Publié") : saved ? (en ? "Saved" : "Sauvegardé") : (en ? "Draft" : "Brouillon")}
            </span>
          </div>

          <div className="editor-body">
            <div className="step-guidance-card">
              <div className="step-guidance-icon">?</div>
              <div>
                <span>{en ? "What to do · about" : "Ce que vous avez à faire · environ"} {currentStep.time}</span>
                <p>{currentStep.guidance}</p>
              </div>
            </div>
            {syncError ? <div className="error-card premium-error-card"><b>{en ? "Synchronization" : "Synchronisation"}</b><p>{syncError}</p></div> : null}

            {step === "identity" ? (
              <>
                <div className="section-kicker">
                  <span>01</span>
                  <div><b>{en ? "Your identity" : "Votre identité"}</b><p>{en ? "These details set the tone for the entire website." : "Ces informations donnent le ton à tout le site."}</p></div>
                </div>

                <div className="grid two">
                  <Field label={en ? "First name" : "Prénom"}>
                    <input spellCheck placeholder="Ex. Julie" value={config.firstName} onChange={(e) => updateIdentityName("firstName", e.target.value)} />
                  </Field>
                  <Field label={en ? "Last name" : "Nom"}>
                    <input spellCheck placeholder="Ex. Martin" value={config.lastName} onChange={(e) => updateIdentityName("lastName", e.target.value)} />
                  </Field>
                </div>

                <Field label={en ? "Website display name" : "Nom affiché du site"} hint={en ? "We pre-fill it with your name. You can replace it with your brand if you have one." : "Nous le préremplissons avec votre nom. Vous pouvez le remplacer par votre marque si vous en avez une."}>
                  <input
                    placeholder={en ? "E.g. Julie Martin Studio" : "Ex. Julie Martin Voyages"}
                    value={config.brandName}
                    onChange={(e) => {
                      setBrandTouched(true);
                      update("brandName", e.target.value);
                    }}
                  />
                </Field>

                <div className="grid two">
                  <Field label={en ? "Preferred address" : "Adresse souhaitée"} hint={en ? "Example: julie-martin" : "Exemple : julien-martin"}>
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

                  <Field label={en ? "Website language" : "Langue"}>
                    <select
                      value={config.language}
                      onChange={(e) => update("language", e.target.value as SiteLanguage)}
                    >
                      <option value="fr">Français</option>
                      <option value="en">English</option>
                      <option value="both" disabled>{en ? "French + English (coming soon)" : "Français + English (à venir)"}</option>
                    </select>
                  </Field>
                </div>

                <div className="section-kicker photo-kicker">
                  <span>02</span>
                  <div><b>{en ? "Your photo" : "Votre photo"}</b><p>{en ? "A real face immediately builds trust." : "Un visage réel renforce immédiatement la confiance."}</p></div>
                </div>

                {remoteMode ? (
                  <Field
                    label={en ? "Profile photo" : "Photo de profil"}
                    hint={en ? "JPEG, PNG, WebP or AVIF · 8 MB maximum. The photo is stored in your Supabase space." : "JPEG, PNG, WebP ou AVIF · 8 Mo maximum. La photo est stockée dans votre espace Supabase."}
                  >
                    <input spellCheck className="file-input" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={uploadPhoto} disabled={busy} />
                  </Field>
                ) : (
                  <Field label={en ? "Profile photo — URL" : "Photo de profil — URL"} hint={en ? "Direct upload works once Supabase is configured." : "L'upload direct fonctionne dès que Supabase est configuré."}>
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
                    <img src={config.profileImageUrl} alt={en ? "Profile photo preview" : "Aperçu de la photo de profil"} />
                    <div>
                      <b>{en ? "Photo uploaded" : "Photo chargée"}</b>
                      <button type="button" onClick={() => update("profileImageUrl", "")}>{en ? "Remove photo" : "Retirer la photo"}</button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {step === "story" ? (
              <>
                <ContentLibraryEditor value={config.contentLibrary} onChange={(contentLibrary) => update("contentLibrary", contentLibrary)} onUpload={async (_asset, file) => {
                  if (!remoteMode) throw new Error(en ? "Sign in to import a file." : "Connectez-vous pour importer un fichier.");
                  const site = remoteSiteId ? { id: remoteSiteId } : await saveMySite(config, false, remoteSiteId || undefined);
                  setRemoteSiteId(site.id);
                  return uploadContentAsset(file, site.id);
                }} />
                <ArchitectureEditor value={config.architecture} library={config.contentLibrary} onChange={(architecture) => update("architecture", architecture)} />
                <details className={"guided-writing-card ai-architect-card " + (!premiumArchitectAvailable ? "premium-feature-locked" : "")}>
                  <summary>
                    <span className="guided-writing-icon">✦</span>
                    <span><b>{en ? "Create my website with AI" : "Créer mon site avec l’IA"}</b><small>{en ? "Premium · describe your needs and get a complete proposal to review." : "Premium · décrivez votre besoin et obtenez une proposition complète à valider."}</small></span>
                    <span className="guided-writing-badge">{premiumArchitectAvailable ? (en ? "New" : "Nouveau") : "🔒 Pro"}</span>
                  </summary>
                  <div className="guided-writing-body">
                    {!premiumArchitectAvailable ? (
                      <div className="premium-feature-lock-note" role="note">
                        <div><b>{en ? "Premium feature" : "Fonctionnalité Premium"}</b><p>{en ? "The full Architect analyzes your needs, builds the structure and writes the website. Standard AI and guided mode remain available on the free plan." : "L’Architecte complet analyse votre besoin, construit l’architecture et rédige le site. L’IA standard et le mode guidé restent disponibles avec l’offre gratuite."}</p></div>
                        <Link className="button secondary" href={premiumAccessHref}>{premiumAccessLabel}</Link>
                      </div>
                    ) : null}
                    <p className="guided-writing-intro">{en ? "Describe your needs freely. The Premium Architect first understands your activity, audience, goal and positioning, then builds the visitor journey, architecture, copy and visual direction. Every proposal goes through a critical audit before you see it." : "Décrivez votre besoin librement. L’Architecte Premium commence par comprendre votre activité, votre public, votre objectif et votre positionnement, puis construit le parcours du visiteur, l’architecture, les textes et la direction visuelle. Chaque proposition passe ensuite par un audit critique avant de vous être montrée."}</p>
                    <div className="architect-brief-guide">
                      <b>{en ? "For the best result, include these details if you know them:" : "Pour un résultat exceptionnel, indiquez si vous les connaissez :"}</b>
                      <span>{en ? "what you offer · who it is for · the desired action · what makes you different · preferred tone · constraints to respect" : "ce que vous proposez · à qui · l’action attendue · ce qui vous différencie · le ton souhaité · les contraintes à respecter"}</span>
                    </div>
                    <label className="guided-question">
                      <span>{en ? "Your needs" : "Votre besoin"}</span>
                      <textarea rows={8} maxLength={4000} value={architectBrief} onChange={(e) => setArchitectBrief(e.target.value)} disabled={!premiumArchitectAvailable} placeholder={en ? "E.g. I am an independent photographer working mainly with couples and families who want natural images. The website should show my style, reassure visitors about my approach and encourage them to contact me. I want something elegant, warm, human and highly visual, without aggressive sales language." : "Ex. Je suis photographe indépendant à Toulouse. Je travaille surtout avec des couples et des familles qui veulent des images naturelles. Le site doit montrer mon univers, rassurer sur mon approche et donner envie de me contacter. Je veux éviter le ton commercial agressif : quelque chose d’élégant, chaleureux, humain et très visuel. Je veux mettre en avant la lumière naturelle, l’émotion et la simplicité."} />
                      <small className={"architect-brief-readiness " + (architectBriefReady ? "is-ready" : "is-thin")}>
                        {architectBriefReady
                          ? (en ? "The brief is detailed enough to start the Premium analysis." : "Brief suffisamment détaillé pour lancer l’analyse Premium.")
                          : architectBriefLength === 0
                            ? (en ? "Start with a few sentences: activity, audience, goal and desired tone." : "Commencez par quelques phrases : activité, public, objectif et ton souhaité.")
                            : (en ? `About ${80 - architectBriefLength} more character${80 - architectBriefLength > 1 ? "s" : ""} to give the Architect enough context.` : `Encore ${80 - architectBriefLength} caractère${80 - architectBriefLength > 1 ? "s" : ""} environ pour donner assez de matière à l’Architecte.`)}
                      </small>
                    </label>
                    <button type="button" className="button primary premium-button" disabled={!premiumArchitectAvailable || architectLoading || !architectBriefReady} onClick={() => void createSiteWithAi()}>{architectLoading ? (en ? "Strategy, creation and audit in progress…" : "Stratégie, création et audit en cours…") : (en ? "Create with Premium Architect" : "Créer avec l’Architecte Premium")} <span aria-hidden="true">→</span></button>
                    {architectProposal ? (
                      <div className="ai-current-note architect-premium-result" role="status">
                        <div className="architect-result-heading">
                          <div>
                            <b>{en ? "Premium proposal ready to review" : "Proposition Premium prête à relire"}</b>
                            <p><strong>{architectProposal.heroTitle}</strong><br />{architectProposal.heroSubtitle}</p>
                          </div>
                          <span className={"architect-readiness " + architectProposal.intelligence.readiness}>
                            {architectProposal.intelligence.readiness === "strong" ? (en ? "Strong brief" : "Brief solide") : architectProposal.intelligence.readiness === "usable" ? (en ? "Usable brief" : "Brief exploitable") : (en ? "Partial brief" : "Brief partiel")}
                          </span>
                        </div>
                        <div className="architect-insight-grid">
                          <article><span>{en ? "Understood need" : "Besoin compris"}</span><p>{architectProposal.intelligence.understoodNeed}</p></article>
                          <article><span>{en ? "Primary audience" : "Public principal"}</span><p>{architectProposal.intelligence.audience}</p></article>
                          <article><span>{en ? "Website goal" : "Objectif du site"}</span><p>{architectProposal.intelligence.primaryGoal}</p></article>
                          <article><span>{en ? "Positioning" : "Positionnement"}</span><p>{architectProposal.intelligence.positioning}</p></article>
                        </div>
                        {architectProposal.intelligence.visitorJourney.length ? (
                          <div className="architect-journey">
                            <b>{en ? "AI-designed visitor journey" : "Parcours visiteur conçu par l’IA"}</b>
                            <div>{architectProposal.intelligence.visitorJourney.map((item, index) => <span key={item + index}><i>{index + 1}</i>{item}</span>)}</div>
                          </div>
                        ) : null}
                        <div className="architect-rationale-grid">
                          <article><b>{en ? "Why this architecture?" : "Pourquoi cette architecture ?"}</b><p>{architectProposal.intelligence.architectureRationale}</p></article>
                          <article><b>{en ? "Why this visual direction?" : "Pourquoi cette direction visuelle ?"}</b><p>{architectProposal.intelligence.designRationale}</p></article>
                        </div>
                        <p>{en ? "Recommended sections" : "Rubriques recommandées"}: {(architectProposal.recommendedModules || []).join(", ") || (en ? "no additional section" : "aucune rubrique supplémentaire")}.</p>
                        <p>{en ? "Architecture" : "Architecture"}: {architectProposal.architecture?.mode === "multi" ? `${architectProposal.architecture.pages.length} pages` : (en ? "single-page website" : "site monopage")} · {(architectProposal.architecture?.pages || []).map((page) => page.title).join(" → ")}.</p>
                        <p>{en ? "Structure" : "Structure"}: {architectProposal.design?.layout} · hero {architectProposal.design?.heroLayout} · {en ? "width" : "largeur"} {architectProposal.design?.contentWidth}.</p>
                        <p>Direction visuelle : <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: "50%", background: architectProposal.design?.accent, verticalAlign: "middle", marginRight: 6 }} /> {architectProposal.design?.background} · {architectProposal.design?.pattern === "none" ? (en ? "solid background" : "fond uni") : `${en ? "pattern" : "motif"} ${architectProposal.design?.pattern}`}.</p>
                        <div className="architect-audit">
                          <b>
                            ✓ {architectProposal.premiumAudit.finalReviewPerformed
                              ? (en ? "Double Premium review passed" : "Double contrôle Premium validé")
                              : (en ? "Premium audit passed" : "Audit Premium validé")}
                          </b>
                          <p>{architectProposal.premiumAudit.qualityNote}</p>
                          {architectProposal.premiumAudit.finalReviewPerformed ? (
                            <small>
                              {en ? "The displayed copy was reviewed a second time after correction by an independent AI critic." : "Le texte affiché a été relu une seconde fois après correction par un critique IA indépendant."}
                            </small>
                          ) : null}
                          {architectProposal.premiumAudit.strategyReused ? (
                            <small>
                              {en ? "Efficient variant: the validated strategy was reused, then creation and quality checks were run again." : "Variante efficiente : la stratégie déjà validée a été conservée, puis la création et les contrôles qualité ont été relancés."}
                            </small>
                          ) : null}
                          {architectProposal.premiumAudit.deterministicChecksPerformed ? (
                            <small>
                              {en ? `Automated structural checks passed · ${architectProposal.premiumAudit.deterministicIssuesDetected} residual alert${architectProposal.premiumAudit.deterministicIssuesDetected > 1 ? "s" : ""} · no blocker.` : <>Contrôle structurel automatique validé · {architectProposal.premiumAudit.deterministicIssuesDetected} alerte{architectProposal.premiumAudit.deterministicIssuesDetected > 1 ? "s" : ""} résiduelle{architectProposal.premiumAudit.deterministicIssuesDetected > 1 ? "s" : ""} · aucun blocage.</>}
                            </small>
                          ) : null}
                          {architectProposal.premiumAudit.strengths.length ? <small>{en ? "Strengths" : "Points forts"}: {architectProposal.premiumAudit.strengths.join(" · ")}</small> : null}
                        </div>
                        <div className="architect-human-eval">
                          <div>
                            <b>Cette proposition correspond-elle vraiment à votre besoin ?</b>
                            <small>Votre réponse aide à améliorer l’Architecte. Aucun texte de votre site n’est envoyé avec cette évaluation.</small>
                          </div>
                          {architectQualitySubmitted ? (
                            <p className="architect-human-eval-thanks">
                              ✓ Merci. Votre évaluation est enregistrée.
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
                                  Oui, c’est pertinent
                                </button>
                                <button
                                  type="button"
                                  className={"button secondary " + (architectQualityChoice === "negative" ? "is-selected" : "")}
                                  disabled={architectQualityBusy}
                                  onClick={() => setArchitectQualityChoice("negative")}
                                >
                                  À améliorer
                                </button>
                              </div>
                              {architectQualityChoice === "negative" ? (
                                <div className="architect-human-eval-reasons">
                                  <span>Qu’est-ce qui vous gêne surtout ?</span>
                                  {([
                                    ["need_mismatch", "Compréhension du besoin"],
                                    ["copy", "Textes"],
                                    ["structure", "Structure / rubriques"],
                                    ["design", "Direction visuelle"],
                                    ["generic", "Trop générique"],
                                    ["other", "Autre"]
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
                                    {architectQualityBusy ? "Enregistrement…" : "Envoyer mon évaluation"}
                                  </button>
                                </div>
                              ) : null}
                            </>
                          )}
                        </div>
                        {architectProposal.intelligence.missingInformation.length ? (
                          <div className="architect-missing architect-clarification">
                            <b>L’Architecte a encore quelques questions</b>
                            <p>
                              Ces réponses sont facultatives. Répondez uniquement à ce que vous
                              connaissez : l’IA réutilisera vos réponses pour reconstruire et
                              réauditer la proposition sans inventer le reste.
                            </p>
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
                                    placeholder="Votre réponse, si vous la connaissez…"
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
                              {architectLoading ? "Nouvelle analyse en cours…" : "Améliorer avec mes réponses"}
                            </button>
                          </div>
                        ) : null}
                        <div className="ai-field-actions"><button type="button" className="button primary premium-button" onClick={() => applyArchitectProposal(architectProposal)}>Appliquer cette proposition</button><button type="button" className="button secondary" onClick={() => void createSiteWithAi()}>Nouvelle proposition</button></div>
                        <small>Rien n’est publié automatiquement. Après application, chaque texte et chaque rubrique restent modifiables.</small>
                      </div>
                    ) : null}
                  </div>
                </details>
                <details className={"guided-writing-card ai-architect-card " + (!premiumArchitectAvailable ? "premium-feature-locked" : "")}>
                  <summary><span className="guided-writing-icon">↻</span><span><b>Modifier tout le site avec l’IA</b><small>Premium · demandez une évolution globale sans écraser automatiquement votre version actuelle.</small></span><span className="guided-writing-badge">{premiumArchitectAvailable ? "Aperçu avant application" : "🔒 Pro"}</span></summary>
                  <div className="guided-writing-body">
                    {!premiumArchitectAvailable ? (
                      <div className="premium-feature-lock-note" role="note">
                        <div><b>Révision globale réservée à Pro</b><p>Vous pouvez toujours modifier chaque champ manuellement ou utiliser l’assistant IA standard prévu dans les champs autorisés.</p></div>
                        <Link className="button secondary" href={premiumAccessHref}>{premiumAccessLabel}</Link>
                      </div>
                    ) : null}
                    <p className="guided-writing-intro">Exemples : « rends le site plus haut de gamme », « passe à trois pages », « mets davantage l’accent sur les familles », « utilise mes photos sur la galerie et simplifie l’accueil ».</p>
                    <label className="guided-question"><span>Modification souhaitée</span><textarea rows={4} maxLength={1200} value={revisionRequest} onChange={(e) => setRevisionRequest(e.target.value)} disabled={!premiumArchitectAvailable} placeholder="Décrivez ce que vous voulez changer. L’IA préservera le reste autant que possible." /></label>
                    <button type="button" className="button primary premium-button" disabled={!premiumArchitectAvailable || revisionLoading || !revisionRequest.trim()} onClick={requestGlobalRevision}>{revisionLoading ? "Préparation de la révision…" : "Préparer la révision"} <span aria-hidden="true">→</span></button>
                    {revisionProposal ? (
                      <div className="ai-current-note revision-preview" role="status">
                        <b>Révision prête à comparer</b>
                        <p><strong>{revisionProposal.heroTitle}</strong><br />{revisionProposal.heroSubtitle}</p>
                        <div className="revision-scope-summary">
                          <span>Zones modifiées</span>
                          {revisionChangeSummary.length ? (
                            <div>{revisionChangeSummary.map((item) => <em key={item}>{item}</em>)}</div>
                          ) : (
                            <p>Aucune différence détectée avec votre version actuelle.</p>
                          )}
                          <small>
                            Tout élément absent de cette liste est conservé. L’IA reçoit aussi cette règle comme contrainte de qualité pendant la révision.
                          </small>
                        </div>
                        <p>Architecture proposée : {revisionProposal.architecture.mode === "multi" ? `${revisionProposal.architecture.pages.length} pages` : "site monopage"} · {revisionProposal.architecture.pages.map((page) => page.title).join(" → ")}.</p>
                        <p>Structure : {revisionProposal.design.layout} · hero {revisionProposal.design.heroLayout} · largeur {revisionProposal.design.contentWidth}.</p>
                        <div className="ai-field-actions">
                          <button type="button" className="button primary premium-button" onClick={() => applyArchitectProposal(revisionProposal)} disabled={revisionChangeSummary.length === 0}>Appliquer cette révision</button>
                          <button type="button" className="button secondary" onClick={() => setRevisionProposal(null)}>Conserver mon site actuel</button>
                        </div>
                        <small>Votre site actuel reste inchangé tant que vous n’appliquez pas cette proposition.</small>
                      </div>
                    ) : null}
                  </div>
                </details>
                <details className="guided-writing-card" open>
                  <summary>
                    <span className="guided-writing-icon">✦</span>
                    <span>
                      <b>Mode guidé recommandé</b>
                      <small>Répondez à 3 questions simples, puis à une 4e facultative : nous préparons une première version de vos textes.</small>
                    </span>
                    <span className="guided-writing-badge">Le plus simple</span>
                  </summary>

                  <div className="guided-writing-body">
                    <p className="guided-writing-intro">
                      Pas besoin de savoir rédiger un site. Répondez comme vous parleriez à quelqu'un.
                      Vous pourrez modifier chaque phrase ensuite.
                    </p>

                    <label className="guided-question">
                      <span><i>1</i> Que proposez-vous ou quelle est votre activité ?</span>
                      <textarea
                        rows={3}
                        placeholder="Ex. Je suis photographe de famille et de couple, avec une approche naturelle et peu posée."
                        value={guidedAnswers.activity}
                        onChange={(e) => setGuidedAnswers((current) => ({ ...current, activity: e.target.value }))}
                      />
                    </label>

                    <label className="guided-question">
                      <span><i>2</i> Qu'est-ce qui caractérise votre approche ?</span>
                      <textarea
                        rows={3}
                        placeholder="Ex. Je prends le temps de mettre les personnes à l'aise et je privilégie des images spontanées, simples et lumineuses."
                        value={guidedAnswers.difference}
                        onChange={(e) => setGuidedAnswers((current) => ({ ...current, difference: e.target.value }))}
                      />
                    </label>

                    <label className="guided-question">
                      <span><i>3</i> Que voulez-vous que le visiteur comprenne ou fasse ?</span>
                      <textarea
                        rows={3}
                        placeholder="Ex. Je veux qu'il comprenne mon style, se sente rassuré sur le déroulement et ait envie de me contacter."
                        value={guidedAnswers.goal}
                        onChange={(e) => setGuidedAnswers((current) => ({ ...current, goal: e.target.value }))}
                      />
                    </label>

                    <label className="guided-question optional">
                      <span><i>4</i> À qui souhaitez-vous surtout parler ? <em>facultatif</em></span>
                      <textarea
                        rows={2}
                        placeholder="Ex. Aux familles et aux couples qui cherchent quelque chose de naturel, chaleureux et sans mise en scène excessive."
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
                      {guidedDraftReady ? "✓ Textes préparés — actualiser" : "Préparer mes textes"}
                      <span aria-hidden="true">→</span>
                    </button>

                    {!guidedDraftEnabled ? (
                      <p className="guided-writing-help">Répondez aux 3 premières questions pour préparer vos textes.</p>
                    ) : guidedDraftReady ? (
                      <p className="guided-writing-success">Votre première version est prête juste en dessous. Relisez-la et modifiez ce qui ne vous ressemble pas.</p>
                    ) : null}
                  </div>
                </details>

                <div className="section-kicker">
                  <span>01</span>
                  <div><b>Votre texte d'accueil</b><p>Le visiteur doit comprendre en quelques secondes ce que vous lui proposez.</p></div>
                </div>
                <div className="question-prompt">
                  <b>Vous gardez toujours le dernier mot.</b>
                  <p>La version préparée n'est qu'un point de départ. Changez les mots pour qu'ils vous ressemblent vraiment.</p>
                </div>
                <Field label="Petite phrase au-dessus du titre" hint="Facultatif. Exemple : Voyagez autrement · partagez davantage.">
                  <input spellCheck maxLength={90} value={config.heroTagline} onChange={(e) => update("heroTagline", e.target.value)} placeholder="Voyage d'abord · découverte ensuite" />
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
                  placeholder="Ex. Une phrase très courte qui résume mon univers sans slogan commercial générique"
                />
                <Field label="Titre principal">
                  <textarea spellCheck rows={2} placeholder="Ex. Une autre façon de préparer et profiter de vos voyages" value={config.heroTitle} onChange={(e) => update("heroTitle", e.target.value)} />
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
                  placeholder="Ex. Un titre clair et mémorable qui fait comprendre rapidement ce que je propose"
                />
                <Field label="Introduction">
                  <textarea spellCheck rows={5} placeholder="En 2 ou 3 phrases : ce que vous avez découvert, ce que cela vous apporte et pourquoi vous souhaitez le partager." value={config.heroSubtitle} onChange={(e) => update("heroSubtitle", e.target.value)} />
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
                  placeholder="Ex. Explique en 2 phrases mon activité, mon approche et ce que le visiteur peut attendre, avec un ton naturel"
                />

                <div className="section-kicker">
                  <span>02</span>
                  <div><b>Votre présentation</b><p>Quelques lignes suffisent si elles sonnent juste et restent personnelles.</p></div>
                </div>
                <Field label="Titre de la rubrique" hint="Facultatif. Votre nom est utilisé si ce champ reste vide.">
                  <input spellCheck maxLength={100} value={config.aboutHeading} onChange={(e) => update("aboutHeading", e.target.value)} placeholder="Ex. Mon histoire" />
                </Field>
                <AiTextAssistant
                  field="aboutHeading"
                  label="le titre de votre présentation"
                  value={config.aboutHeading}
                  language={config.language}
                  affiliation={config.affiliation}
                  firstName={config.firstName}
                  brandName={config.brandName}
                  siteContext={aiSiteContext}
                  onApply={(text) => update("aboutHeading", text)}
                  placeholder="Ex. Un titre personnel et simple, moins formel que « À propos »"
                />
                <Field label="Votre présentation">
                  <textarea spellCheck rows={7} placeholder="Parlez de vous comme vous le feriez à quelqu'un que vous venez de rencontrer : votre rapport au voyage, votre expérience et ce que vous aimez partager." value={config.aboutText} onChange={(e) => update("aboutText", e.target.value)} />
                </Field>
                <AiTextAssistant
                  field="aboutText"
                  label="votre présentation"
                  value={config.aboutText}
                  language={config.language}
                  affiliation={config.affiliation}
                  firstName={config.firstName}
                  brandName={config.brandName}
                  siteContext={aiSiteContext}
                  onApply={(text) => update("aboutText", text)}
                  placeholder="Ex. Présente-moi de façon humaine à partir de mon parcours, de mon approche et de ce qui compte dans ma façon de travailler"
                />
              </>
            ) : null}

            {step === "design" ? (
              <>
                <MediaLibrary design={config.design} onChange={(design) => update("design", design)} />
                <div className="photo-background-editor module-editor">
                  <b>Photo personnelle en arrière-plan</b>
                  <p>La photo est compressée avant l'envoi et affichée en mode cover. AJG cherche automatiquement le point d'intérêt de l'image pour le centrage initial ; vous pouvez ensuite l'ajuster avec les curseurs.</p>
                  <label className="background-upload-field">Importer une photo<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploadingImage || busy} onChange={(event) => void uploadDesignImage(event, "background")} /></label>
                  {uploadingImage ? <p className="background-upload-status" role="status">Optimisation et envoi de la photo…</p> : null}
                  {config.design.backgroundPhotoUrl ? (
                    <div className="background-photo-adjustments">
                      <button type="button" className="button secondary background-remove-button" onClick={() => update("design", { ...config.design, backgroundPhotoUrl: "" })}>Retirer la photo de fond</button>
                      <label className="background-position-control">
                        <span>Position horizontale <strong>{config.design.backgroundPositionX} %</strong></span>
                        <input aria-label="Position horizontale de la photo de fond" type="range" min="0" max="100" step="1" value={config.design.backgroundPositionX} onChange={(e) => update("design", { ...config.design, backgroundPositionX: Number(e.target.value) })} />
                        <small><span>Gauche</span><span>Droite</span></small>
                      </label>
                      <label className="background-position-control">
                        <span>Position verticale <strong>{config.design.backgroundPositionY} %</strong></span>
                        <input aria-label="Position verticale de la photo de fond" type="range" min="0" max="100" step="1" value={config.design.backgroundPositionY} onChange={(e) => update("design", { ...config.design, backgroundPositionY: Number(e.target.value) })} />
                        <small><span>Haut</span><span>Bas</span></small>
                      </label>
                    </div>
                  ) : null}
                </div>
                <label className="option-card premium-option-card portrait-option">
                  <input spellCheck type="checkbox" checked={config.design.showPortrait} onChange={(event) => update("design", { ...config.design, showPortrait: event.target.checked })} />
                  <span><b>Afficher le portrait dans l'accueil</b><p>Si vous n'avez pas ajouté de photo, vos initiales apparaissent. Décochez pour laisser davantage de place à l'image de fond.</p></span>
                </label>
              </>
            ) : null}

            {step === "booking" ? (
              <>
                <div className="visibility-options-stack">
                  <VisibilityOption
                    checked={config.design.showBooking}
                    title="Rendez-vous sur le site"
                    activeLabel="Activé"
                    inactiveLabel="Désactivé"
                    description={config.design.showBooking
                      ? "Les accès au rendez-vous peuvent apparaître sur le site dès qu'un lien valide est renseigné."
                      : "Tous les accès au rendez-vous sont masqués. Le texte et le lien restent enregistrés pour plus tard."}
                    onChange={(checked) => update("design", { ...config.design, showBooking: checked })}
                  />
                  {config.design.showBooking ? (
                    <VisibilityOption
                      checked={config.design.showPrimaryButton}
                      title="Bouton principal dans l’accueil"
                      activeLabel="Visible"
                      inactiveLabel="Masqué"
                      description={config.design.showPrimaryButton
                        ? "Avec un lien valide, le bouton apparaît dans le hero en plus de l'accès dans la navigation."
                        : "Avec un lien valide, l'accès reste dans la navigation mais le gros bouton du hero est masqué."}
                      onChange={(checked) => update("design", { ...config.design, showPrimaryButton: checked })}
                    />
                  ) : null}
                </div>
                <div className={`booking-visibility-summary ${!config.design.showBooking || bookingLinkStatus !== "valid" ? "warning" : "active"}`}>
                  <span aria-hidden="true">{!config.design.showBooking ? "○" : bookingLinkStatus === "valid" ? "✓" : "!"}</span>
                  <div>
                    <b>Ce que verra le visiteur</b>
                    <p>
                      {!config.design.showBooking
                        ? "Aucun accès au rendez-vous : la fonction est désactivée."
                        : bookingLinkStatus !== "valid"
                          ? "Aucun bouton pour le moment : ajoutez un lien de rendez-vous HTTPS valide ci-dessous."
                          : config.design.showPrimaryButton
                            ? "Un accès dans la navigation + le bouton principal dans l’accueil."
                            : "Un accès dans la navigation uniquement. Le bouton principal de l’accueil est masqué."}
                    </p>
                  </div>
                </div>
                <div className="booking-guide">
                  <b>Comment ajouter votre agenda ?</b>
                  <ol>
                    <li>Ouvrez votre page de réservation Calendly, Google Calendar ou un autre agenda.</li>
                    <li>Copiez son adresse dans la barre du navigateur ou avec le bouton de partage.</li>
                    <li>Collez cette adresse dans le champ ci-dessous. Un message confirmera si le lien est complet.</li>
                  </ol>
                  <p>Vous n'avez pas encore d'agenda en ligne ? Laissez le champ vide pour le moment.</p>
                </div>
                <div className="section-kicker">
                  <span>01</span>
                  <div><b>Votre rendez-vous</b><p>Un seul lien suffit pour transformer l'intérêt en échange.</p></div>
                </div>
                <Field label="Texte du bouton" hint="Ce texte apparaîtra sur le bouton lorsque vous aurez ajouté un lien de rendez-vous.">
                  <input spellCheck placeholder="Ex. Découvrir la plateforme" value={config.bookingLabel} onChange={(e) => update("bookingLabel", e.target.value)} />
                </Field>
                <AiTextAssistant
                  field="bookingLabel"
                  label="le bouton de rendez-vous"
                  value={config.bookingLabel}
                  language={config.language}
                  affiliation={config.affiliation}
                  firstName={config.firstName}
                  brandName={config.brandName}
                  siteContext={aiSiteContext}
                  onApply={(text) => update("bookingLabel", text)}
                  placeholder="Ex. Un appel à l'action rassurant, sans pression commerciale"
                />
                <Field label="Lien de rendez-vous" hint="Facultatif. Le lien doit commencer par https:// et contenir l'adresse complète de votre page.">
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
                    ? "✓ Lien reconnu. Vérifiez qu'il ouvre bien votre page de réservation."
                    : bookingLinkStatus === "invalid"
                      ? "Le lien semble incomplet. Copiez l'adresse entière, par exemple https://calendly.com/votre-nom/30min."
                      : "Vous pouvez continuer sans lien et l'ajouter plus tard."}
                </p>

                <div className="section-kicker">
                  <span>02</span>
                  <div><b>Vos réseaux</b><p>Optionnels, mais utiles pour prolonger la relation hors du site.</p></div>
                </div>
                <div className="grid two">
                  <label className="option-card premium-option-card"><input type="checkbox" checked={config.design.showInstagram} onChange={(e) => update("design", { ...config.design, showInstagram: e.target.checked })} /><span><b>Afficher Instagram</b></span></label>
                  <label className="option-card premium-option-card"><input type="checkbox" checked={config.design.showFacebook} onChange={(e) => update("design", { ...config.design, showFacebook: e.target.checked })} /><span><b>Afficher Facebook</b></span></label>
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
                  <div><b>Modules du site</b><p>Les contenus affichés sur votre site doivent être prêts à être partagés.</p></div>
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
                  siteContext={aiSiteContext}
                />

                <div className="section-kicker">
                  <span>02</span>
                  <div><b>Activité et identité</b><p>Les mentions MWR Life concernent uniquement les sites d'ambassadeurs.</p></div>
                </div>
                <Field label="Votre activité">
                  <select value={config.affiliation} onChange={(event) => updateAffiliation(event.target.value as SiteConfig["affiliation"])}>
                    <option value="mwr">Ambassadeur indépendant MWR Life</option>
                    <option value="independent">Autre activité indépendante</option>
                  </select>
                </Field>
                {config.affiliation === "mwr" ? <>
                  <div className="locked premium-locked">
                    <span>Mention d'indépendance maintenue</span>
                    <p>{requiredDisclaimer}</p>
                  </div>
                  <p className="media-license-note">Les logos sont facultatifs. Activez uniquement les visuels que votre activité vous autorise à utiliser ; ils ne remplacent pas la mention d'indépendance.</p>
                  <div className="visibility-options-stack logo-visibility-options">
                    <VisibilityOption
                      checked={config.design.showMwrLogo}
                      title="Logo MWR Life « Independent Distributor »"
                      activeLabel="Affiché"
                      inactiveLabel="Masqué"
                      description={config.design.showMwrLogo
                        ? "Le logo sera visible en bas du site avec la mention d'indépendance obligatoire."
                        : "Le logo n'apparaît pas sur le site. La mention d'indépendance reste affichée."}
                      logo="/logos/mwr-life-independent.svg"
                      onChange={(checked) => update("design", { ...config.design, showMwrLogo: checked })}
                    />
                    <VisibilityOption
                      checked={config.design.showTravelAdvantageLogo}
                      title="Logo Travel Advantage « Independent Distributor »"
                      activeLabel="Affiché"
                      inactiveLabel="Masqué"
                      description={config.design.showTravelAdvantageLogo
                        ? "Le logo sera visible en bas du site avec la mention d'indépendance obligatoire."
                        : "Le logo n'apparaît pas sur le site. La mention d'indépendance reste affichée."}
                      logo="/logos/travel-advantage-independent.svg"
                      onChange={(checked) => update("design", { ...config.design, showTravelAdvantageLogo: checked })}
                    />
                  </div>
                </> : <div className="helper-card premium-helper-card">
                  <b>Site indépendant sans mention MWR Life</b>
                  <p>Les mentions automatiques et logos MWR Life et Travel Advantage seront absents. Les pages légales ci-dessous seront adaptées aux informations que vous renseignez.</p>
                </div>}

                <div className="section-kicker">
                  <span>03</span>
                  <div><b>Conformité du site</b><p>Préparez automatiquement les pages légales et la transparence RGPD du site.</p></div>
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
                  <div><b>Contrôle final</b><p>Une dernière vérification avant de rendre le site accessible.</p></div>
                </div>
                {errors.length ? (
                  <div className="error-card premium-error-card">
                    <b>À corriger avant publication</b>
                    <ul>{errors.map((error) => (
                      <li key={error.message}>
                        <button type="button" className="review-error-link" onClick={() => {
                          setStep(error.step);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}>
                          {error.message} · Corriger dans « {steps.find((item) => item.key === error.step)?.label} »
                        </button>
                      </li>
                    ))}</ul>
                  </div>
                ) : (
                  <div className="success-card premium-success-card review-success">
                    <div>
                      <b>{remoteMode ? "Contrôle qualité structurel réussi." : "Le site est prêt pour le prototype local."}</b>
                      <p>
                        {remoteMode
                          ? "Identité, message, liens requis et conformité structurelle sont cohérents. Relisez l'aperçu visuel avant publication."
                          : "Configurez Supabase pour rendre cette publication accessible depuis un autre appareil."}
                      </p>
                    </div>
                  </div>
                )}

                <div className="quality-summary-card">
                  <div className="quality-summary-head">
                    <div><span className="mini">QUALITY CHECK AJG</span><strong>{qualityPassed}/{qualityChecks.length} contrôles réussis</strong></div>
                    <span className={qualityWarnings ? "quality-score warning" : "quality-score done"}>{qualityWarnings ? `${qualityWarnings} amélioration${qualityWarnings > 1 ? "s" : ""}` : "Prêt ✓"}</span>
                  </div>
                  <div className="quality-check-list">
                    {qualityChecks.map((check) => <button type="button" key={check.label} className={`quality-check ${check.status}`} onClick={() => { setStep(check.step); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                      <span>{check.status === "pass" ? "✓" : "!"}</span>
                      <p><b>{check.label}</b><small>{check.detail}</small></p>
                      <i>{check.status === "pass" ? "Voir →" : "Corriger →"}</i>
                    </button>)}
                  </div>
                  <p className="quality-note">Les recommandations n’empêchent pas la publication. Les erreurs indispensables restent bloquantes au-dessus.</p>
                </div>
                <div className="quality-summary-card">
                  <div className="quality-summary-head"><div><span className="mini">RELECTURE ÉDITORIALE</span><strong>Orthographe, grammaire et clarté</strong></div></div>
                  <p>Les contrôles automatiques ci-dessus vérifient la structure. Lancez une relecture IA pour obtenir des corrections de texte à accepter individuellement.</p>
                  <button type="button" className="secondary" disabled={reviewing || busy} onClick={() => void reviewWithAi()}>{reviewing ? "Relecture en cours…" : "Relire avec l’IA"}</button>
                  {reviewResult ? <div role="status" aria-live="polite"><p>{reviewResult.issues.length ? `${reviewResult.issues.length} suggestion(s) de rédaction` : "Aucune correction éditoriale suggérée."}</p>{reviewResult.issues.map((issue, index) => <div className="module-item" key={`${issue.field}-${index}`}><b>{reviewFieldLabels[issue.field] || issue.field} : {issue.reason}</b>{reviewResult.suggestions[issue.field] ? <><p><small>Texte actuel</small><br />{currentReviewText(issue.field)}</p><p><small>Proposition</small><br />{reviewResult.suggestions[issue.field]}</p><button type="button" className="secondary" onClick={() => { update(issue.field, reviewResult.suggestions[issue.field] as never, true); setReviewResult((previous) => previous ? { ...previous, issues: previous.issues.filter((_, i) => i !== index) } : null); }}>Utiliser cette correction</button></> : null}</div>)}</div> : null}
                </div>

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
                  <div className={config.affiliation === "mwr" ? "done" : "optional"}>
                    <span>{config.affiliation === "mwr" ? "✓" : "○"}</span>
                    <p><b>Activité</b><small>{config.affiliation === "mwr" ? "Mention d'indépendance affichée" : "Mentions légales à vérifier"}</small></p>
                  </div>
                </div>

                <div className="publish-summary premium-publish-summary">
                  <div><span>Lien du site après publication</span><strong>{betaPublicUrl}</strong></div>
                  <div><span>Langue</span><strong>{config.language === "both" ? "Français (bilingue à venir)" : config.language.toUpperCase()}</strong></div>
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
            <div className="preview-heading-actions">
              <div className="preview-device-switch" aria-label="Format de l'aperçu">
                <button type="button" className={previewDevice === "desktop" ? "active" : ""} aria-pressed={previewDevice === "desktop"} onClick={() => setPreviewDevice("desktop")}>Ordinateur</button>
                <button type="button" className={previewDevice === "mobile" ? "active" : ""} aria-pressed={previewDevice === "mobile"} onClick={() => setPreviewDevice("mobile")}>Mobile</button>
              </div>
              <Link href="/preview">Plein écran ↗</Link>
            </div>
          </div>
          <div className={`preview-device-frame ${previewDevice === "mobile" ? "is-mobile" : "is-desktop"}`}>
            <div className="device-dots"><i /><i /><i /></div>
            <SitePreview config={config} compact />
          </div>
          <div className="preview-note">
            <span>✦</span>
            <p>{previewDevice === "mobile" ? "Aperçu mobile simulé : vérifiez notamment le cadrage de la photo, la longueur des titres et les boutons." : "Vous voyez le résultat en direct. Rien n'est public avant l'étape « Publication »."}</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
