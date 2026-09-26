"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import SitePreview from "../../components/SitePreview";
import MediaLibrary from "../../components/MediaLibrary";
import ModulesEditor from "../../components/ModulesEditor";
import AiTextAssistant from "../../components/AiTextAssistant";
import {
  defaultSiteConfig,
  requiredDisclaimer,
  type SiteConfig,
  type SiteLanguage
} from "../../lib/site-config";
import { loadDraft, publishDraft, saveDraft } from "../../lib/site-store";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../../lib/supabase-browser";
import { optimizeBackgroundImage, optimizeImage } from "../../lib/optimize-image";
import { contrastRatio, surfaceInk } from "../../lib/site-design";
import {
  getCurrentUser,
  getMySite,
  saveMySite,
  signOut,
  uploadProfileImage,
  uploadSiteImage
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
    key: "design",
    label: "Style",
    eyebrow: "Votre ambiance",
    description: "Couleurs, motifs, images et sons pour donner une identité personnelle à votre site.",
    time: "5 min",
    guidance: "Commencez par une couleur et un motif. Vous pouvez rechercher une image ou un son, puis revenir changer vos choix plus tard."
  },
  {
    key: "booking",
    label: "Rendez-vous",
    eyebrow: "Passer à l'action",
    description: "Reliez votre agenda et vos réseaux pour transformer la visite en échange concret.",
    time: "2 min",
    guidance: "Copiez l'adresse de votre page de réservation, puis collez-la ci-dessous. Vous pouvez aussi passer cette étape et y revenir plus tard."
  },
  {
    key: "options",
    label: "Options",
    eyebrow: "Votre contenu",
    description: "Configurez les rubriques facultatives, leur contenu et leur ordre d'affichage.",
    time: "2 min",
    guidance: "Activez uniquement les rubriques utiles. Elles restent masquées tant qu'elles ne contiennent pas de contenu publiable."
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
  const [guidedAnswers, setGuidedAnswers] = useState({
    traveler: "",
    discovery: "",
    benefit: "",
    audience: ""
  });
  const [guidedDraftReady, setGuidedDraftReady] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [reviewResult, setReviewResult] = useState<{ issues: { field: keyof SiteConfig; reason: string }[]; suggestions: Record<string, string> } | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [changeVersion, setChangeVersion] = useState(0);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const latestVersion = useRef(0);

  useEffect(() => {
    if (!remoteMode || !ready || changeVersion === 0) return;
    const version = changeVersion;
    const timer = window.setTimeout(() => {
      saveQueue.current = saveQueue.current.catch(() => undefined).then(async () => {
        const remote = await saveMySite(config, false);
        setRemoteSiteId(remote.id);
        if (version === latestVersion.current) setSaved(true);
      }).catch((error) => setSyncError(error instanceof Error ? error.message : "Sauvegarde automatique impossible."));
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [config, changeVersion, ready, remoteMode]);

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
    const neutralIntro = "Présentez votre activité, votre approche et ce que vos visiteurs peuvent découvrir avec vous.";
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
      "Les textes actuels seront remplacés par la nouvelle proposition. Voulez-vous continuer ?"
    )) return;

    setBusy(true);
    setSyncError("");
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("L'assistant IA nécessite une connexion au site.");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Reconnectez-vous pour préparer vos textes avec l'IA.");

      const response = await fetch("/api/ai/write", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          field: "guidedDraft",
          instruction: "À partir des réponses guidées, rédige une première version complète, structurée et soignée des textes du site. Reformule les notes courtes en vraies phrases. Ne copie pas mécaniquement les réponses.",
          currentText: "",
          context: {
            language: config.language,
            affiliation: config.affiliation,
            firstName: config.firstName,
            brandName: config.brandName,
            siteContext: {
              guidedTraveler: guidedAnswers.traveler,
              guidedDiscovery: guidedAnswers.discovery,
              guidedBenefit: guidedAnswers.benefit,
              guidedAudience: guidedAnswers.audience
            }
          }
        })
      });
      const data = await response.json();
      if (!response.ok || !data?.draft) throw new Error(data?.error || "Impossible de préparer les textes.");

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
      setSyncError(error instanceof Error ? error.message : "Impossible de préparer les textes.");
    } finally {
      setBusy(false);
    }
  };

  const guidedDraftEnabled =
    guidedAnswers.traveler.trim().length > 0 &&
    guidedAnswers.discovery.trim().length > 0 &&
    guidedAnswers.benefit.trim().length > 0;

  const aiSiteContext = {
    heroTagline: config.heroTagline,
    heroTitle: config.heroTitle,
    heroSubtitle: config.heroSubtitle,
    aboutHeading: config.aboutHeading,
    aboutText: config.aboutText,
    guidedTraveler: guidedAnswers.traveler,
    guidedDiscovery: guidedAnswers.discovery,
    guidedBenefit: guidedAnswers.benefit,
    guidedAudience: guidedAnswers.audience
  };

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
    checks.push({ label: "Conformité activité", detail: config.affiliation === "mwr" ? "La mention d’indépendance obligatoire sera affichée." : "Site indépendant : vérifiez les mentions propres à votre activité.", status: config.affiliation === "mwr" ? "pass" : "warn", step: "options" });
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
    return next;
  }, [config, bookingLinkStatus]);

  const save = async () => {
    setBusy(true);
    setSyncError("");
    try {
      await saveQueue.current;
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
      await saveQueue.current;
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

  const reviewWithAi = async () => {
    setReviewing(true);
    setSyncError("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      if (!data.session?.access_token) throw new Error("Reconnectez-vous pour lancer la relecture IA.");
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
      const site = remoteSiteId ? { id: remoteSiteId } : await saveMySite(config, false);
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
            <small>{config.slug ? publicPath : "Adresse à définir"}</small>
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
                    <input spellCheck placeholder="Ex. Julie" value={config.firstName} onChange={(e) => updateIdentityName("firstName", e.target.value)} />
                  </Field>
                  <Field label="Nom">
                    <input spellCheck placeholder="Ex. Martin" value={config.lastName} onChange={(e) => updateIdentityName("lastName", e.target.value)} />
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
                      <option value="both" disabled>Français + English (à venir)</option>
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
                    <input spellCheck className="file-input" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={uploadPhoto} disabled={busy} />
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
                      <span><i>1</i> Quel type de voyageur êtes-vous ?</span>
                      <textarea
                        rows={3}
                        placeholder="Ex. J'aime partir en couple ou avec des amis, découvrir les cultures locales et garder du temps pour profiter sur place."
                        value={guidedAnswers.traveler}
                        onChange={(e) => setGuidedAnswers((current) => ({ ...current, traveler: e.target.value }))}
                      />
                    </label>

                    <label className="guided-question">
                      <span><i>2</i> Comment avez-vous découvert cette façon de voyager ?</span>
                      <textarea
                        rows={3}
                        placeholder="Ex. Je cherchais surtout une solution pour mes propres voyages avant de penser à la recommander."
                        value={guidedAnswers.discovery}
                        onChange={(e) => setGuidedAnswers((current) => ({ ...current, discovery: e.target.value }))}
                      />
                    </label>

                    <label className="guided-question">
                      <span><i>3</i> Qu'est-ce que vous appréciez le plus aujourd'hui ?</span>
                      <textarea
                        rows={3}
                        placeholder="Ex. J'apprécie de pouvoir comparer plus facilement et de disposer de plusieurs outils au même endroit."
                        value={guidedAnswers.benefit}
                        onChange={(e) => setGuidedAnswers((current) => ({ ...current, benefit: e.target.value }))}
                      />
                    </label>

                    <label className="guided-question optional">
                      <span><i>4</i> À qui souhaitez-vous surtout parler ? <em>facultatif</em></span>
                      <textarea
                        rows={2}
                        placeholder="Ex. Aux personnes qui aiment voyager et veulent simplement regarder si le concept peut leur correspondre."
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
                  placeholder="Ex. Une phrase chaleureuse et très courte sur le plaisir de voyager autrement"
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
                  placeholder="Ex. Un titre simple, rassurant et premium pour des personnes qui aiment voyager"
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
                  placeholder="Ex. Explique en 2 phrases que je partage une solution que j'utilise moi-même pour mes voyages, avec un ton naturel"
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
                  placeholder="Ex. Présente-moi de façon humaine : j'aime voyager en couple, découvrir la gastronomie locale et partager les bons plans que j'utilise vraiment"
                />
              </>
            ) : null}

            {step === "design" ? (
              <>
                <MediaLibrary design={config.design} onChange={(design) => update("design", design)} />
                <div className="photo-background-editor module-editor">
                  <b>Photo personnelle en arrière-plan</b>
                  <p>La photo est compressée avant l'envoi et affichée en mode cover. AJG cherche automatiquement le point d'intérêt de l'image pour le centrage initial ; vous pouvez ensuite l'ajuster avec les curseurs.</p>
                  <label>Importer une photo<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploadingImage || busy} onChange={(event) => void uploadDesignImage(event, "background")} /></label>
                  {uploadingImage ? <p role="status">Optimisation et envoi de la photo…</p> : null}
                  {config.design.backgroundPhotoUrl ? <>
                    <button type="button" className="secondary" onClick={() => update("design", { ...config.design, backgroundPhotoUrl: "" })}>Retirer la photo de fond</button>
                    <label>Position horizontale : {config.design.backgroundPositionX} %<input type="range" min="0" max="100" value={config.design.backgroundPositionX} onChange={(e) => update("design", { ...config.design, backgroundPositionX: Number(e.target.value) })} /></label>
                    <label>Position verticale : {config.design.backgroundPositionY} %<input type="range" min="0" max="100" value={config.design.backgroundPositionY} onChange={(e) => update("design", { ...config.design, backgroundPositionY: Number(e.target.value) })} /></label>
                  </> : null}
                </div>
                <label className="option-card premium-option-card portrait-option">
                  <input spellCheck type="checkbox" checked={config.design.showPortrait} onChange={(event) => update("design", { ...config.design, showPortrait: event.target.checked })} />
                  <span><b>Afficher le portrait dans l'accueil</b><p>Si vous n'avez pas ajouté de photo, vos initiales apparaissent. Décochez pour laisser davantage de place à l'image de fond.</p></span>
                </label>
              </>
            ) : null}

            {step === "booking" ? (
              <>
                <label className="option-card premium-option-card"><input type="checkbox" checked={config.design.showBooking} onChange={(e) => update("design", { ...config.design, showBooking: e.target.checked })} /><span><b>Afficher le rendez-vous</b><p>Désactivez pour masquer tous les liens de réservation sans effacer votre adresse.</p></span></label>
                {config.design.showBooking ? <label className="option-card premium-option-card"><input type="checkbox" checked={config.design.showPrimaryButton} onChange={(e) => update("design", { ...config.design, showPrimaryButton: e.target.checked })} /><span><b>Afficher le bouton principal dans l’accueil</b><p>Le lien de rendez-vous peut rester dans la navigation si ce bouton est masqué.</p></span></label> : null}
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
                <ModulesEditor modules={config.design.modules} onChange={(modules) => update("design", { ...config.design, modules })} onImage={(event) => void uploadDesignImage(event, "gallery")} uploading={uploadingImage || busy} />

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
                  <label className="option-card premium-option-card">
                    <input spellCheck type="checkbox" checked={config.design.showMwrLogo} onChange={(event) => update("design", { ...config.design, showMwrLogo: event.target.checked })} />
                    <span><b>Afficher le logo MWR Life « Independent Distributor »</b><p>Je confirme pouvoir utiliser ce visuel dans le cadre de mon activité.</p></span>
                  </label>
                  <label className="option-card premium-option-card">
                    <input spellCheck type="checkbox" checked={config.design.showTravelAdvantageLogo} onChange={(event) => update("design", { ...config.design, showTravelAdvantageLogo: event.target.checked })} />
                    <span><b>Afficher le logo Travel Advantage « Independent Distributor »</b><p>Je confirme pouvoir utiliser ce visuel dans le cadre de mon activité.</p></span>
                  </label>
                </> : <div className="helper-card premium-helper-card">
                  <b>Site indépendant sans mention MWR Life</b>
                  <p>Les mentions automatiques et logos MWR Life et Travel Advantage seront absents. Relisez les textes que vous avez rédigés. Les informations légales propres à votre activité ne sont pas encore générées par cet éditeur ; vérifiez-les avant de partager le site.</p>
                </div>}
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
