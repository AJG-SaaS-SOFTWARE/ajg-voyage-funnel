"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountShell } from "../../components/AccountShell";
import { startAiLaunchCheckout, startPlanCheckout } from "../../lib/billing-access";
import {
  freeEntitlements,
  getMyAiUsage,
  getMyBetaAccess,
  getMySiteAiAccess,
  getMySiteEntitlements,
  getMyStorageUsage,
  type AiUsage,
  type BetaAccess,
  type SiteAiAccess,
  type StorageUsage,
  type SubscriptionEntitlements
} from "../../lib/subscription";
import { getMySites } from "../../lib/supabase-site-repository";
import { useProductLocale } from "../../lib/product-i18n";

const emptyAiAccess: SiteAiAccess = {
  canCreateSite: false,
  canReviseSite: false,
  accessSource: "none",
  launchOperationsRemaining: 0
};

export default function PlansPage() {
  const { locale, tr } = useProductLocale();
  const [current, setCurrent] = useState<SubscriptionEntitlements>(freeEntitlements);
  const [aiAccess, setAiAccess] = useState<SiteAiAccess>(emptyAiAccess);
  const [betaAccess, setBetaAccess] = useState<BetaAccess>({ active: false, startsAt: null, expiresAt: null });
  const [annualIncludesLaunch, setAnnualIncludesLaunch] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [usage, setUsage] = useState<AiUsage>({ today: 0, month: 0 });
  const [storage, setStorage] = useState<StorageUsage>({ usedBytes: 0, limitMb: freeEntitlements.storageMb });
  const [sites, setSites] = useState<Array<{ id: string; slug: string }>>([]);
  const [siteId, setSiteId] = useState("");
  const [checkoutBusy, setCheckoutBusy] = useState("");
  const [checkoutMessage, setCheckoutMessage] = useState("");

  const load = async (selectedId?: string) => {
    const owned = await getMySites();
    const site = owned.find((item) => item.id === (selectedId || siteId)) || owned[0];
    setSites(owned.map((item) => ({ id: item.id, slug: item.slug })));
    if (site && !siteId) setSiteId(site.id);
    const [entitlements, access, aiUsage, storageUsage, beta] = await Promise.all([
      site ? getMySiteEntitlements(site.id) : Promise.resolve(freeEntitlements),
      site ? getMySiteAiAccess(site.id) : Promise.resolve(emptyAiAccess),
      getMyAiUsage(),
      getMyStorageUsage(site?.id),
      getMyBetaAccess().catch(() => ({ active: false, startsAt: null, expiresAt: null }))
    ]);
    setCurrent(entitlements);
    setAiAccess(access);
    setUsage(aiUsage);
    setStorage(storageUsage);
    setBetaAccess(beta);
    setLoaded(true);
  };

  useEffect(() => {
    void fetch("/api/billing/offer", { cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(data => setAnnualIncludesLaunch(data?.annualIncludesLaunch === true))
      .catch(() => setAnnualIncludesLaunch(false));
    void load().catch(() => {
      setCurrent(freeEntitlements);
      setAiAccess(emptyAiAccess);
      setLoaded(true);
    });
  }, []);

  async function beginCheckout(planKey: "essential" | "growth", billingCycle: "monthly" | "annual") {
    if (!siteId || betaAccess.active) return;
    const key = `${planKey}:${billingCycle}`;
    setCheckoutBusy(key);
    setCheckoutMessage("");
    try {
      await startPlanCheckout(siteId, planKey, billingCycle);
    } catch (error) {
      setCheckoutMessage(error instanceof Error ? error.message : tr("Checkout indisponible.", "Checkout unavailable."));
      setCheckoutBusy("");
    }
  }

  async function buyAiLaunch() {
    if (!siteId || betaAccess.active) return;
    setCheckoutBusy("ai_launch");
    setCheckoutMessage("");
    try {
      await startAiLaunchCheckout(siteId);
    } catch (error) {
      setCheckoutMessage(error instanceof Error ? error.message : tr("Paiement Création IA indisponible.", "AI Launch checkout unavailable."));
      setCheckoutBusy("");
    }
  }

  const betaExpiryLabel =
    betaAccess.active && betaAccess.expiresAt
      ? new Date(betaAccess.expiresAt).toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR")
      : "";

  const paidPlan = current.planKey === "essential" || current.planKey === "growth";
  const selectedSite = sites.find((site) => site.id === siteId) || sites[0];
  const aiUsagePercent = current.aiMonthlyLimit > 0 ? Math.min(100, (usage.month / current.aiMonthlyLimit) * 100) : 0;
  const storageLimitBytes = Math.max(1, storage.limitMb * 1024 * 1024);
  const storageUsagePercent = Math.min(100, (storage.usedBytes / storageLimitBytes) * 100);

  return (
    <AccountShell
      active="plans"
      eyebrow={tr("BUILD · RUN · GROW", "BUILD · RUN · GROW")}
      title={tr("Mon offre", "My plan")}
      description={tr(
        "La création complète du site est un service BUILD ponctuel. Essentiel assure le RUN du site. Growth ajoute le pilotage et l'amélioration continue.",
        "Full website creation is a one-time BUILD service. Essential covers website RUN. Growth adds ongoing management and improvement."
      )}
    >
      {sites.length > 1 ? (
        <section className="panel">
          <label>
            {tr("Site", "Website")}
            <select value={siteId} onChange={(event) => { setSiteId(event.target.value); void load(event.target.value); }}>
              {sites.map((site) => <option key={site.id} value={site.id}>{site.slug}</option>)}
            </select>
          </label>
        </section>
      ) : null}

      {loaded ? (
        <section className={`account-plan-overview ${betaAccess.active ? "is-beta" : ""}`}>
          <div className="account-plan-overview-copy">
            <div className="account-plan-status-row">
              <p className="eyebrow">{tr("Votre offre", "Your plan")}</p>
              <span className="account-status-pill">
                {betaAccess.active ? "Beta Tester" : tr("Accès actif", "Active access")}
              </span>
            </div>
            <h2>{betaAccess.active ? "Growth" : current.planName}</h2>
            <p>
              {betaAccess.active
                ? tr(
                    "BUILD + Growth complet sont ouverts pendant votre test, sans abonnement Stripe ni conversion payante automatique.",
                    "Full BUILD + Growth are available during your test, with no Stripe subscription or automatic paid conversion."
                  )
                : tr(
                    "Retrouvez ici les capacités actives de votre site, vos quotas et les options disponibles pour le faire évoluer.",
                    "See your website’s active capabilities, quotas and available upgrade options here."
                  )}
            </p>
            <div className="account-plan-meta">
              {selectedSite ? <span>{tr("Site", "Website")} <b>{selectedSite.slug}</b></span> : null}
              {betaExpiryLabel ? <span>{tr("Accès bêta jusqu’au", "Beta access until")} <b>{betaExpiryLabel}</b></span> : null}
            </div>
          </div>
          <div className="account-plan-overview-actions">
            <Link className="button primary" href="/builder">{tr("Ouvrir le Builder", "Open Builder")} <span aria-hidden="true">→</span></Link>
            <Link className="text-link" href={locale === "en" ? "/pricing" : "/tarifs"}>{tr("Comparer les offres", "Compare plans")}</Link>
          </div>
        </section>
      ) : null}

      {loaded ? (
        <section className="account-metrics-grid" aria-label={tr("Capacités et utilisation", "Capabilities and usage")}>
          <article className="account-metric-card">
            <div className="account-metric-heading">
              <span className="account-metric-icon" aria-hidden="true">✦</span>
              <div>
                <p className="eyebrow">{tr("Création IA", "AI Launch")}</p>
                <small>BUILD</small>
              </div>
            </div>
            <h3>
              {betaAccess.active
                ? tr("Disponible", "Available")
                : aiAccess.launchOperationsRemaining > 0
                  ? `${aiAccess.launchOperationsRemaining} ${tr("restante(s)", "remaining")}`
                  : tr("Non incluse", "Not included")}
            </h3>
            <p>{tr("Création ou refonte globale d’une première version du site.", "Create or globally refine a first website version.")}</p>
            {!betaAccess.active && paidPlan && aiAccess.launchOperationsRemaining === 0 ? (
              <button type="button" className="button secondary account-metric-action" disabled={Boolean(checkoutBusy)} onClick={() => void buyAiLaunch()}>
                {checkoutBusy === "ai_launch" ? tr("Ouverture…", "Opening…") : tr("Ajouter · 49 €", "Add · €49")}
              </button>
            ) : null}
          </article>

          <article className="account-metric-card">
            <div className="account-metric-heading">
              <span className="account-metric-icon" aria-hidden="true">AI</span>
              <div>
                <p className="eyebrow">{tr("Assistant IA", "AI assistant")}</p>
                <small>{tr("Usage mensuel", "Monthly usage")}</small>
              </div>
            </div>
            <h3>{usage.month} / {current.aiMonthlyLimit}</h3>
            <p>{tr("générations utilisées ce mois-ci", "generations used this month")}</p>
            <div
              className="account-meter"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={current.aiMonthlyLimit}
              aria-valuenow={Math.min(usage.month, current.aiMonthlyLimit)}
              aria-label={tr("Utilisation IA mensuelle", "Monthly AI usage")}
            >
              <span style={{ width: `${aiUsagePercent}%` }} />
            </div>
            <div className="account-metric-meta">
              <span>{usage.today} / {current.aiDailyLimit} {tr("aujourd’hui", "today")}</span>
              <span>{current.aiMinuteLimit}/min</span>
            </div>
          </article>

          <article className="account-metric-card">
            <div className="account-metric-heading">
              <span className="account-metric-icon" aria-hidden="true">▣</span>
              <div>
                <p className="eyebrow">{tr("Stockage", "Storage")}</p>
                <small>{tr("Médias et documents", "Media and documents")}</small>
              </div>
            </div>
            <h3>{(storage.usedBytes / 1024 / 1024).toFixed(storage.usedBytes > 10 * 1024 * 1024 ? 0 : 1)} MB</h3>
            <p>{tr("sur", "of")} {storage.limitMb} MB {tr("disponibles", "available")}</p>
            <div
              className="account-meter"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={storageLimitBytes}
              aria-valuenow={Math.min(storage.usedBytes, storageLimitBytes)}
              aria-label={tr("Utilisation du stockage", "Storage usage")}
            >
              <span style={{ width: `${storageUsagePercent}%` }} />
            </div>
            <div className="account-metric-meta">
              <span>{tr("Photos, audio, documents", "Photos, audio, documents")}</span>
              <span>{Math.round(storageUsagePercent)}%</span>
            </div>
          </article>
        </section>
      ) : null}

      {checkoutMessage ? <p className="account-note" role="status">{checkoutMessage}</p> : null}

      <section className="account-offer-explainer">
        <div>
          <p className="eyebrow">BUILD → RUN → GROW</p>
          <h2>{tr("Une logique simple pour faire vivre votre site.", "A simple model to keep your website moving.")}</h2>
        </div>
        <div className="account-offer-flow" aria-label={tr("Fonctionnement des offres", "How plans work")}>
          <span><b>BUILD</b><small>{tr("Créer", "Create")}</small></span>
          <i aria-hidden="true">→</i>
          <span><b>RUN</b><small>{tr("Maintenir", "Maintain")}</small></span>
          <i aria-hidden="true">→</i>
          <span><b>GROW</b><small>{tr("Améliorer", "Improve")}</small></span>
        </div>
        <Link className="text-link" href={locale === "en" ? "/pricing" : "/tarifs"}>{tr("Découvrir les offres", "Explore plans")} →</Link>
      </section>

      <section className="plans-grid plans-grid-three" aria-label={tr("Offres AJG", "AJG plans")}>
        <article className={!betaAccess.active && current.planKey === "free" ? "plan-card current" : "plan-card"}>
          <p className="eyebrow">{tr("Bêta / découverte", "Beta / discovery")}</p>
          <h2>{tr("Tester le produit", "Test the product")}</h2>
          <p className="plan-price">0 €</p>
          <ul>
            <li>{tr("Sous-domaine AJG", "AJG subdomain")}</li>
            <li>{tr("IA standard bornée", "Bounded standard AI")}</li>
            <li>{tr("Édition et publication essentielles", "Core editing and publishing")}</li>
          </ul>
          <p className="plan-status">{loaded && !betaAccess.active && current.planKey === "free" ? tr("Votre accès actuel", "Your current access") : tr("Accès de découverte", "Discovery access")}</p>
        </article>

        <article className={!betaAccess.active && current.planKey === "essential" ? "plan-card current" : "plan-card"}>
          <p className="eyebrow">RUN</p>
          <h2>{tr("Essentiel", "Essential")}</h2>
          <p className="plan-price">15 € <small>/ {tr("mois", "month")}</small></p>
          <p className="annual-price">{tr("ou", "or")} 150 € / {tr("an", "year")} · 1 {tr("site", "website")}</p>
          <ul>
            <li>{tr("Hébergement et publication", "Hosting and publishing")}</li>
            <li>{tr("Domaine personnalisé", "Custom domain")}</li>
            <li>{tr("Éditeur complet", "Full editor")}</li>
            <li>{tr("IA rédactionnelle légère", "Light AI writing assistance")}</li>
            <li>{tr("SEO et analytics essentiels", "Essential SEO and analytics")}</li>
            <li>{tr("Sauvegardes et self-service", "Backups and self-service")}</li>
          </ul>
          <p className="plan-status">{loaded && current.planKey === "essential" && !betaAccess.active ? tr("Votre offre actuelle", "Your current plan") : tr("RUN du site", "Website RUN")}</p>
          {!betaAccess.active && current.planKey !== "essential" ? (
            <div className="builder-actions">
              <button type="button" className="button secondary" disabled={Boolean(checkoutBusy)} onClick={() => void beginCheckout("essential", "monthly")}>
                {checkoutBusy === "essential:monthly" ? tr("Ouverture…", "Opening…") : tr("15 €/mois", "€15/month")}
              </button>
              <button type="button" className="button secondary" disabled={Boolean(checkoutBusy)} onClick={() => void beginCheckout("essential", "annual")}>
                {checkoutBusy === "essential:annual" ? tr("Ouverture…", "Opening…") : tr("150 €/an", "€150/year")}
              </button>
            </div>
          ) : null}
        </article>

        <article className={current.planKey === "growth" ? "plan-card current pro-offer-card" : "plan-card pro-offer-card"}>
          <p className="eyebrow">RUN + GROW</p>
          <h2>Growth</h2>
          <p className="plan-price">29 € <small>/ {tr("mois", "month")}</small></p>
          <p className="annual-price">{tr("ou", "or")} 290 € / {tr("an", "year")} · 1 {tr("site", "website")}</p>
          <ul>
            <li>{tr("Tout Essentiel", "Everything in Essential")}</li>
            <li>{tr("AI Website Manager", "AI Website Manager")}</li>
            <li>{tr("Diagnostics et recommandations continues", "Continuous diagnostics and recommendations")}</li>
            <li>{tr("SEO / AEO et conversion", "SEO / AEO and conversion")}</li>
            <li>{tr("Révisions globales du site par IA", "AI-powered global website revisions")}</li>
            <li>{annualIncludesLaunch ? tr("Création IA initiale incluse avec Growth annuel", "Initial AI Launch included with annual Growth") : tr("Création IA disponible séparément : 49 € une fois", "AI Launch available separately: €49 once")}</li>
          </ul>
          <p className="plan-status">
            {betaAccess.active
              ? tr("Inclus dans votre statut Beta Tester", "Included with your Beta Tester status")
              : loaded && current.planKey === "growth"
                ? tr("Votre offre actuelle", "Your current plan")
                : tr("Pilotage et amélioration continue", "Ongoing management and improvement")}
          </p>
          {!betaAccess.active && current.planKey !== "growth" ? (
            <div className="builder-actions">
              <button type="button" className="button primary" disabled={Boolean(checkoutBusy)} onClick={() => void beginCheckout("growth", "monthly")}>
                {checkoutBusy === "growth:monthly" ? tr("Ouverture…", "Opening…") : tr("29 €/mois", "€29/month")}
              </button>
              <button type="button" className="button secondary" disabled={Boolean(checkoutBusy)} onClick={() => void beginCheckout("growth", "annual")}>
                {checkoutBusy === "growth:annual" ? tr("Ouverture…", "Opening…") : annualIncludesLaunch ? tr("290 €/an · Création IA incluse", "€290/year · AI Launch included") : tr("290 €/an", "€290/year")}
              </button>
            </div>
          ) : null}
        </article>
      </section>

      <section className="panel founding-note">
        <p className="eyebrow">{tr("Bêta & lancement", "Beta & launch")}</p>
        <h2>{tr("Les testeurs ne sont pas des clients payants", "Beta testers are not paying customers")}</h2>
        <p>{tr(
          "Les Beta Testers reçoivent temporairement BUILD + Growth complet pour mesurer qualité, usages et coûts. La grille Essentiel 15 € / Growth 29 € / Création IA 49 € est préparée en sandbox ; aucun paiement commercial n’est encore ouvert.",
          "Beta Testers temporarily receive full BUILD + Growth access to measure quality, usage and costs. The Essential €15 / Growth €29 / AI Launch €49 grid is prepared in sandbox; commercial payments are not open yet."
        )}</p>
      </section>
    </AccountShell>
  );
}
