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

      {loaded && betaAccess.active ? (
        <section className="usage-card beta-access-banner" role="status">
          <div>
            <p className="eyebrow">Beta Tester</p>
            <h2>{tr("Accès BUILD + Growth complet offert pendant la bêta", "Full BUILD + Growth access included during beta")}</h2>
            <p>
              {tr("Concepteur IA, pilotage Growth, domaine personnalisé et fonctions payantes sont ouverts sans abonnement Stripe", "AI Site Architect, Growth management, custom domain and paid features are enabled without a Stripe subscription")}
              {betaExpiryLabel ? " " + tr("jusqu’au", "until") + " " + betaExpiryLabel : ""}.{" "}
              {tr("À l’expiration, le site revient automatiquement à son offre réelle.", "When beta access expires, the website automatically returns to its actual plan.")}
            </p>
          </div>
        </section>
      ) : null}

      {loaded ? (
        <section className="usage-card">
          <div>
            <p className="eyebrow">{tr("Droit BUILD", "BUILD entitlement")}</p>
            <h2>
              {betaAccess.active
                ? tr("Création IA disponible sans compteur pendant la bêta", "AI Launch available without a counter during beta")
                : aiAccess.launchOperationsRemaining > 0
                  ? `${aiAccess.launchOperationsRemaining} ${tr("opération(s) complète(s) restante(s)", "full operation(s) remaining")}`
                  : tr("Aucune Création IA disponible", "No AI Launch available")}
            </h2>
            <p>{tr(
              "Une opération BUILD réussie peut créer ou raffiner globalement la première version. Une génération qui échoue est automatiquement remboursée.",
              "A successful BUILD operation can create or globally refine the first version. A failed generation is automatically refunded."
            )}</p>
          </div>
          {!betaAccess.active && paidPlan && aiAccess.launchOperationsRemaining === 0 ? (
            <button type="button" className="button secondary" disabled={Boolean(checkoutBusy)} onClick={() => void buyAiLaunch()}>
              {checkoutBusy === "ai_launch" ? tr("Ouverture…", "Opening…") : tr("Ajouter la Création IA · 49 €", "Add AI Launch · €49")}
            </button>
          ) : null}
        </section>
      ) : null}

      {loaded ? (
        <section className="usage-card" aria-label={tr("Utilisation IA", "AI usage")}>
          <div>
            <p className="eyebrow">{tr("IA standard", "Standard AI")}</p>
            <h2>{usage.month} / {current.aiMonthlyLimit} {tr("générations ce mois-ci", "generations this month")}</h2>
            <p>{usage.today} / {current.aiDailyLimit} {tr("aujourd’hui", "today")} · {current.aiMinuteLimit}/min</p>
          </div>
          <progress max={current.aiMonthlyLimit} value={Math.min(usage.month, current.aiMonthlyLimit)} />
        </section>
      ) : null}

      {loaded ? (
        <section className="usage-card" aria-label={tr("Utilisation stockage", "Storage usage")}>
          <div>
            <p className="eyebrow">{tr("Stockage", "Storage")}</p>
            <h2>{(storage.usedBytes / 1024 / 1024).toFixed(storage.usedBytes > 10 * 1024 * 1024 ? 0 : 1)} MB / {storage.limitMb} MB</h2>
            <p>{tr("Photos, images, audio et documents importés dans AJG.", "Photos, images, audio and documents uploaded to AJG.")}</p>
          </div>
          <progress max={storage.limitMb * 1024 * 1024} value={Math.min(storage.usedBytes, storage.limitMb * 1024 * 1024)} />
        </section>
      ) : null}

      {checkoutMessage ? <p className="account-note" role="status">{checkoutMessage}</p> : null}

      <section className="pricing-positioning panel">
        <p className="eyebrow">BUILD → RUN → GROW</p>
        <h2>{tr("Payez la création une fois, puis le service dont votre site a réellement besoin.", "Pay for creation once, then for the ongoing service your website actually needs.")}</h2>
        <p>{tr(
          "Essentiel maintient et fait fonctionner votre site. Growth analyse, conseille et aide à le faire progresser. Le Concepteur IA complet est un droit BUILD distinct ; son inclusion éventuelle dans Growth annuel dépend de l’offre activée.",
          "Essential keeps your website running. Growth analyzes, advises and helps improve it. Full AI Site Architect creation is a separate BUILD entitlement; any annual Growth inclusion depends on the activated offer."
        )}</p>
        <p><Link className="text-link" href={locale === "en" ? "/pricing" : "/tarifs"}>{tr("Voir la page Tarifs publique", "View the public pricing page")} →</Link></p>
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
