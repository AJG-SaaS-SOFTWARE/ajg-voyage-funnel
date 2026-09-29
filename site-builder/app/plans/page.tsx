"use client";

import { useEffect, useState } from "react";
import { AccountShell } from "../../components/AccountShell";
import {
  freeEntitlements,
  getMyAiUsage,
  getMyBetaAccess,
  getMySiteEntitlements,
  getMyStorageUsage,
  type AiUsage,
  type BetaAccess,
  type StorageUsage,
  type SubscriptionEntitlements
} from "../../lib/subscription";
import { getMySites } from "../../lib/supabase-site-repository";
import { useProductLocale } from "../../lib/product-i18n";

export default function PlansPage() {
  const { locale, tr } = useProductLocale();
  const [current, setCurrent] = useState<SubscriptionEntitlements>(freeEntitlements);
  const [betaAccess, setBetaAccess] = useState<BetaAccess>({
    active: false,
    startsAt: null,
    expiresAt: null
  });
  const [loaded, setLoaded] = useState(false);
  const [usage, setUsage] = useState<AiUsage>({ today: 0, month: 0 });
  const [storage, setStorage] = useState<StorageUsage>({
    usedBytes: 0,
    limitMb: freeEntitlements.storageMb
  });
  const [sites, setSites] = useState<Array<{ id: string; slug: string }>>([]);
  const [siteId, setSiteId] = useState("");

  const load = async (selectedId?: string) => {
    const owned = await getMySites();
    const site = owned.find((item) => item.id === (selectedId || siteId)) || owned[0];

    setSites(owned.map((item) => ({ id: item.id, slug: item.slug })));
    if (site && !siteId) setSiteId(site.id);

    const [entitlements, aiUsage, storageUsage, beta] = await Promise.all([
      site ? getMySiteEntitlements(site.id) : Promise.resolve(freeEntitlements),
      getMyAiUsage(),
      getMyStorageUsage(site?.id),
      getMyBetaAccess().catch(() => ({
        active: false,
        startsAt: null,
        expiresAt: null
      }))
    ]);

    setCurrent(entitlements);
    setUsage(aiUsage);
    setStorage(storageUsage);
    setBetaAccess(beta);
    setLoaded(true);
  };

  useEffect(() => {
    void load().catch(() => {
      setCurrent(freeEntitlements);
      setLoaded(true);
    });
  }, []);

  const betaExpiryLabel =
    betaAccess.active && betaAccess.expiresAt
      ? new Date(betaAccess.expiresAt).toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR")
      : "";

  return (
    <AccountShell
      active="plans"
      eyebrow={tr("Offre & usages", "Plan & usage")}
      title={tr("Mon offre", "My plan")}
      description={tr("AJG ne se positionne pas comme un constructeur de sites low-cost : l’offre Pro ajoute un véritable Architecte IA qui travaille la stratégie, l’architecture, le contenu et la direction visuelle du site, tout en vous laissant le contrôle.", "AJG is not positioned as a low-cost website builder: Pro adds a true AI Site Architect that works on strategy, architecture, content and visual direction while keeping you in control.")}
    >
      {sites.length > 1 ? (
        <section className="panel">
          <label>
            Site
            <select
              value={siteId}
              onChange={(event) => {
                setSiteId(event.target.value);
                void load(event.target.value);
              }}
            >
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.slug}
                </option>
              ))}
            </select>
          </label>
        </section>
      ) : null}

      {loaded && betaAccess.active ? (
        <section className="usage-card beta-access-banner" role="status">
          <div>
            <p className="eyebrow">Beta Tester</p>
            <h2>{tr("Accès Pro complet offert pendant la bêta", "Full Pro access included during beta")}</h2>
            <p>
              {tr("Architecte IA Premium, domaine personnalisé, quotas Pro et toutes les fonctions payantes sont ouverts sans abonnement Stripe", "Premium AI Site Architect, custom domain, Pro quotas and all paid features are enabled without a Stripe subscription")}{betaExpiryLabel ? " " + tr("jusqu’au", "until") + " " + betaExpiryLabel : ""}. {tr("À l’expiration, le site revient automatiquement à son offre réelle.", "When beta access expires, the website automatically returns to its actual plan.")}
            </p>
          </div>
        </section>
      ) : null}

      {loaded ? (
        <section className="usage-card" aria-label={tr("Utilisation IA", "AI usage")}>
          <div>
            <p className="eyebrow">{tr("Votre utilisation", "Your usage")}</p>
            <h2>
              {usage.month} / {current.aiMonthlyLimit} {tr("générations IA ce mois-ci", "AI generations this month")}
            </h2>
            <p>
              {usage.today} / {current.aiDailyLimit} {tr("aujourd’hui", "today")} · {tr("limite instantanée", "instant limit")}{" "}
              {current.aiMinuteLimit}/min
            </p>
          </div>
          <progress
            max={current.aiMonthlyLimit}
            value={Math.min(usage.month, current.aiMonthlyLimit)}
            aria-label={tr("Quota IA mensuel utilisé", "Monthly AI quota used")}
          />
        </section>
      ) : null}

      {loaded ? (
        <section className="usage-card" aria-label={tr("Utilisation stockage", "Storage usage")}>
          <div>
            <p className="eyebrow">{tr("Stockage", "Storage")}</p>
            <h2>
              {(storage.usedBytes / 1024 / 1024).toFixed(
                storage.usedBytes > 10 * 1024 * 1024 ? 0 : 1
              )}{" "}
              MB / {storage.limitMb} MB
            </h2>
            <p>{tr("Photos, images, audio et documents importés dans AJG.", "Photos, images, audio and documents uploaded to AJG.")}</p>
          </div>
          <progress
            max={storage.limitMb * 1024 * 1024}
            value={Math.min(
              storage.usedBytes,
              storage.limitMb * 1024 * 1024
            )}
            aria-label={tr("Quota de stockage utilisé", "Storage quota used")}
          />
        </section>
      ) : null}

      {loaded && !["active", "trialing"].includes(current.status) && !betaAccess.active ? (
        <section className="usage-card" role="status">
          <div>
            <p className="eyebrow">{tr("Abonnement à régulariser", "Subscription requires action")}</p>
            <h2>{tr("Votre abonnement nécessite une régularisation", "Your subscription requires an update")}</h2>
            <p>
              {tr("Consultez l’espace Facturation pour connaître précisément les capacités encore disponibles et les dates de restriction, suspension publique et export.", "Open Billing to see the capabilities still available and the dates for restriction, public suspension and export.")}
            </p>
          </div>
        </section>
      ) : null}

      <section className="pricing-positioning panel">
        <p className="eyebrow">{tr("Positionnement AJG", "AJG positioning")}</p>
        <h2>{tr("Deux niveaux d’aide IA, une même base de contrôle", "Two levels of AI support, one foundation of control")}</h2>
        <p>
          {tr("L’IA standard vous aide à rédiger, reformuler, structurer des rubriques et avancer champ par champ. L’Architecte Premium va plus loin : il analyse le projet, construit la stratégie et l’arborescence, produit une proposition cohérente puis la contrôle et la raffine avant application.", "Standard AI helps you write, rewrite and structure sections field by field. The Premium Site Architect goes further: it analyzes the project, builds strategy and site structure, creates a coherent proposal, then reviews and refines it before application.")}
        </p>
        <blockquote>
          {tr("Votre site ne commence pas par un template. Il commence par votre activité.", "Your website does not start with a template. It starts with your activity.")}
        </blockquote>
      </section>

      <section className="plans-grid plans-grid-three" aria-label={tr("Offres AJG", "AJG plans")}>
        <article className={!betaAccess.active && current.planKey === "free" ? "plan-card current" : "plan-card"}>
          <p className="eyebrow">{tr("Gratuit", "Free")}</p>
          <h2>{tr("Créer et tester", "Create and test")}</h2>
          <p className="plan-price">0 €</p>
          <ul>
            <li>{tr("1 site sur sous-domaine AJG", "1 website on an AJG subdomain")}</li>
            <li>{tr("IA standard : rédaction, reformulation, mode guidé et rubriques", "Standard AI: writing, rewriting, guided mode and sections")}</li>
            <li>{tr("80 générations IA / mois", "80 AI generations / month")}</li>
            <li>{tr("250 Mo de stockage", "250 MB storage")}</li>
            <li>{tr("Édition et publication essentielles", "Core editing and publishing")}</li>
            <li>{tr("Architecte IA Premium non inclus", "Premium AI Site Architect not included")}</li>
          </ul>
          <p className="plan-status">
            {loaded && !betaAccess.active && current.planKey === "free"
              ? tr("Votre offre actuelle", "Your current plan")
              : tr("Offre d’entrée", "Entry plan")}
          </p>
        </article>

        <article className="plan-card plan-card-roadmap">
          <p className="eyebrow">Essential · {tr("trajectoire", "roadmap")}</p>
          <h2>{tr("Construire avec l’aide de l’IA", "Build with AI assistance")}</h2>
          <p className="plan-price">{tr("Tarif à tester après la bêta", "Price to test after beta")}</p>
          <ul>
            <li>{tr("1 site professionnel", "1 professional website")}</li>
            <li>{tr("Domaine personnalisé prévu", "Custom domain planned")}</li>
            <li>{tr("IA standard avec quotas plus généreux", "Standard AI with higher quotas")}</li>
            <li>{tr("Éditeur, personnalisation et publication complets", "Full editor, customization and publishing")}</li>
            <li>{tr("Sans Architecte IA Premium", "Without Premium AI Site Architect")}</li>
          </ul>
          <p className="plan-status">
            {tr("Offre conservée dans la gamme cible, mais volontairement non commercialisée avant les retours des testeurs.", "Kept in the target product range, but intentionally not sold before beta feedback.")}
          </p>
        </article>

        <article className={current.planKey === "pro" ? "plan-card current pro-offer-card" : "plan-card pro-offer-card"}>
          <p className="eyebrow">Founding Pro</p>
          <h2>{tr("L’IA conçoit le site avec vous", "AI designs the website with you")}</h2>
          <p className="plan-price">
            24,90 € <small>/ {tr("mois", "month")}</small>
          </p>
          <p className="annual-price">{tr("ou", "or")} 239 € / {tr("an", "year")} · 1 {tr("site", "website")}</p>
          <ul>
            <li>{tr("Tout ce qui est prévu dans Essential", "Everything planned in Essential")}</li>
            <li>{tr("500 générations IA / mois", "500 AI generations / month")}</li>
            <li>{tr("2 Go de stockage", "2 GB storage")}</li>
            <li>{tr("Architecte Premium : stratégie → architecture → création → audit → raffinement", "Premium Site Architect: strategy → architecture → creation → audit → refinement")}</li>
            <li>{tr("Architecture, textes, modules et direction visuelle cohérents", "Coherent architecture, copy, modules and visual direction")}</li>
            <li>{tr("Domaine personnalisé", "Custom domain")}</li>
          </ul>
          <p className="plan-status">
            {betaAccess.active
              ? tr("Inclus gratuitement dans votre statut Beta Tester", "Included free with your Beta Tester status")
              : loaded && current.planKey === "pro"
                ? tr("Votre offre actuelle", "Your current plan")
                : tr("Offre Founding prévue pour les 10 premiers clients payants", "Founding offer planned for the first 10 paying customers")}
          </p>
          {!betaAccess.active && current.planKey !== "pro" ? (
            <button type="button" className="button primary" disabled>
              {tr("Souscription ouverte après la bêta", "Subscriptions open after beta")}
            </button>
          ) : null}
        </article>
      </section>

      <section className="panel founding-note">
        <p className="eyebrow">{tr("Bêta & lancement", "Beta & launch")}</p>
        <h2>{tr("Les testeurs ne sont pas des clients payants", "Beta testers are not paying customers")}</h2>
        <p>
          {tr("Les proches invités à la bêta reçoivent temporairement l’accès Pro complet pour évaluer le produit réel. Ils peuvent supprimer leur site ensuite et ne sont pas engagés dans l’offre Founding. Le tarif Founding sera testé au lancement commercial ; Essential sera décidé à partir des usages observés.", "People invited to the beta temporarily receive full Pro access to evaluate the real product. They can delete their website afterwards and are not committed to the Founding offer. Founding pricing will be tested at commercial launch; Essential will be decided from observed usage.")}
        </p>
      </section>
    </AccountShell>
  );
}
