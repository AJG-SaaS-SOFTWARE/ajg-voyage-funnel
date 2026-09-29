"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountShell } from "../../components/AccountShell";
import { startPlanCheckout } from "../../lib/billing-access";
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
  const [betaAccess, setBetaAccess] = useState<BetaAccess>({ active: false, startsAt: null, expiresAt: null });
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
    const [entitlements, aiUsage, storageUsage, beta] = await Promise.all([
      site ? getMySiteEntitlements(site.id) : Promise.resolve(freeEntitlements),
      getMyAiUsage(),
      getMyStorageUsage(site?.id),
      getMyBetaAccess().catch(() => ({ active: false, startsAt: null, expiresAt: null }))
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

  async function beginCheckout(planKey: "essential" | "pro", billingCycle: "monthly" | "annual") {
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

  const betaExpiryLabel =
    betaAccess.active && betaAccess.expiresAt
      ? new Date(betaAccess.expiresAt).toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR")
      : "";

  return (
    <AccountShell
      active="plans"
      eyebrow={tr("Offre & usages", "Plan & usage")}
      title={tr("Mon offre", "My plan")}
      description={tr(
        "AJG Site Builder ne se positionne pas comme un constructeur de sites low-cost : Essentiel vous aide à construire avec l’IA rédactionnelle, tandis que Pro IA ajoute un véritable Concepteur IA qui travaille la stratégie, l’architecture, le contenu et la direction visuelle du site.",
        "AJG Site Builder is not positioned as a low-cost website builder: Essential helps you build with writing AI, while Pro AI adds a true AI Designer working on strategy, architecture, content and visual direction."
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
            <h2>{tr("Accès Pro IA complet offert pendant la bêta", "Full Pro access included during beta")}</h2>
            <p>
              {tr("Concepteur IA, domaine personnalisé, quotas Pro et toutes les fonctions payantes sont ouverts sans abonnement Stripe", "AI Designer, custom domain, Pro quotas and all paid features are enabled without a Stripe subscription")}
              {betaExpiryLabel ? " " + tr("jusqu’au", "until") + " " + betaExpiryLabel : ""}.{" "}
              {tr("À l’expiration, le site revient automatiquement à son offre réelle.", "When beta access expires, the website automatically returns to its actual plan.")}
            </p>
          </div>
        </section>
      ) : null}

      {loaded ? (
        <section className="usage-card" aria-label={tr("Utilisation IA", "AI usage")}>
          <div>
            <p className="eyebrow">{tr("Votre utilisation", "Your usage")}</p>
            <h2>{usage.month} / {current.aiMonthlyLimit} {tr("générations IA ce mois-ci", "AI generations this month")}</h2>
            <p>{usage.today} / {current.aiDailyLimit} {tr("aujourd’hui", "today")} · {tr("limite instantanée", "instant limit")} {current.aiMinuteLimit}/min</p>
          </div>
          <progress max={current.aiMonthlyLimit} value={Math.min(usage.month, current.aiMonthlyLimit)} aria-label={tr("Quota IA mensuel utilisé", "Monthly AI quota used")} />
        </section>
      ) : null}

      {loaded ? (
        <section className="usage-card" aria-label={tr("Utilisation stockage", "Storage usage")}>
          <div>
            <p className="eyebrow">{tr("Stockage", "Storage")}</p>
            <h2>{(storage.usedBytes / 1024 / 1024).toFixed(storage.usedBytes > 10 * 1024 * 1024 ? 0 : 1)} MB / {storage.limitMb} MB</h2>
            <p>{tr("Photos, images, audio et documents importés dans AJG.", "Photos, images, audio and documents uploaded to AJG.")}</p>
          </div>
          <progress max={storage.limitMb * 1024 * 1024} value={Math.min(storage.usedBytes, storage.limitMb * 1024 * 1024)} aria-label={tr("Quota de stockage utilisé", "Storage quota used")} />
        </section>
      ) : null}

      {loaded && !["active", "trialing"].includes(current.status) && !betaAccess.active ? (
        <section className="usage-card" role="status">
          <div>
            <p className="eyebrow">{tr("Abonnement à régulariser", "Subscription requires action")}</p>
            <h2>{tr("Votre abonnement nécessite une régularisation", "Your subscription requires an update")}</h2>
            <p>{tr("Consultez l’espace Facturation pour connaître précisément les capacités encore disponibles et les dates de restriction, suspension publique et export.", "Open Billing to see the capabilities still available and the dates for restriction, public suspension and export.")}</p>
          </div>
        </section>
      ) : null}

      {checkoutMessage ? <p className="account-note" role="status">{checkoutMessage}</p> : null}

      <section className="pricing-positioning panel">
        <p className="eyebrow">{tr("Positionnement AJG", "AJG positioning")}</p>
        <h2>{tr("Deux niveaux d’aide IA, une même base de contrôle", "Two levels of AI support, one foundation of control")}</h2>
        <p>{tr(
          "Essentiel intègre l’IA rédactionnelle pour rédiger, reformuler et structurer le contenu champ par champ. Pro IA va plus loin : le Concepteur IA analyse le projet, construit une première architecture cohérente et aide à raffiner le site avant application.",
          "Essential includes writing AI to draft, rewrite and structure content field by field. Pro AI goes further: the AI Designer analyzes the project, builds a coherent first architecture and helps refine the website before application."
        )}</p>
        <blockquote>{tr("Votre site ne commence pas par un template. Il commence par votre activité.", "Your website does not start with a template. It starts with your activity.")}</blockquote>
        <p><Link className="text-link" href={locale === "en" ? "/pricing" : "/tarifs"}>{tr("Voir la page Tarifs publique", "View the public pricing page")} →</Link></p>
      </section>

      <section className="plans-grid plans-grid-three" aria-label={tr("Offres AJG", "AJG plans")}>
        <article className={!betaAccess.active && current.planKey === "free" ? "plan-card current" : "plan-card"}>
          <p className="eyebrow">{tr("Gratuit", "Free")}</p>
          <h2>{tr("Créer et tester", "Create and test")}</h2>
          <p className="plan-price">0 €</p>
          <ul>
            <li>{tr("1 site sur sous-domaine AJG", "1 website on an AJG subdomain")}</li>
            <li>{tr("IA standard : rédaction, reformulation, mode guidé et rubriques", "Standard AI: writing, rewriting, guided mode and sections")}</li>
            <li>{tr("80 générations IA / mois pendant la phase bêta", "80 AI generations / month during beta")}</li>
            <li>{tr("250 Mo de stockage pendant la phase bêta", "250 MB storage during beta")}</li>
            <li>{tr("Édition et publication essentielles", "Core editing and publishing")}</li>
            <li>{tr("Concepteur IA non inclus hors statut Beta Tester", "AI Designer not included outside Beta Tester status")}</li>
          </ul>
          <p className="plan-status">{loaded && !betaAccess.active && current.planKey === "free" ? tr("Votre offre actuelle", "Your current plan") : tr("Accès de découverte / bêta", "Discovery / beta access")}</p>
        </article>

        <article className={!betaAccess.active && current.planKey === "essential" ? "plan-card current" : "plan-card"}>
          <p className="eyebrow">{tr("Essentiel", "Essential")}</p>
          <h2>{tr("Construire avec l’aide de l’IA", "Build with AI assistance")}</h2>
          <p className="plan-price">19 € <small>/ {tr("mois", "month")}</small></p>
          <p className="annual-price">{tr("ou", "or")} 190 € / {tr("an", "year")} · 1 {tr("site", "website")}</p>
          <ul>
            <li>{tr("1 site professionnel", "1 professional website")}</li>
            <li>{tr("Domaine personnalisé", "Custom domain")}</li>
            <li>{tr("IA rédactionnelle et amélioration dans les champs utiles", "Writing AI and improvement in relevant fields")}</li>
            <li>{tr("Éditeur, personnalisation et publication complets", "Full editor, customization and publishing")}</li>
            <li>{tr("Hébergement inclus", "Hosting included")}</li>
            <li>{tr("Sans Concepteur IA complet", "Without the full AI Designer")}</li>
          </ul>
          <p className="plan-status">
            {current.status === "trialing" && current.planKey === "essential"
              ? tr("Essai Pro IA en cours · Essentiel sera votre offre après l’essai", "Pro AI trial active · Essential will be your plan after the trial")
              : loaded && current.planKey === "essential" && !betaAccess.active
                ? tr("Votre offre actuelle", "Your current plan")
                : tr("14 jours de Pro IA avant passage à Essentiel", "14 days of Pro AI before switching to Essential")}
          </p>
          {!betaAccess.active && current.planKey !== "essential" ? (
            <div className="builder-actions">
              <button type="button" className="button secondary" disabled={Boolean(checkoutBusy)} onClick={() => void beginCheckout("essential", "monthly")}>
                {checkoutBusy === "essential:monthly" ? tr("Ouverture…", "Opening…") : tr("Essayer puis 19 €/mois", "Try then €19/month")}
              </button>
              <button type="button" className="button secondary" disabled={Boolean(checkoutBusy)} onClick={() => void beginCheckout("essential", "annual")}>
                {checkoutBusy === "essential:annual" ? tr("Ouverture…", "Opening…") : tr("Essayer puis 190 €/an", "Try then €190/year")}
              </button>
            </div>
          ) : null}
        </article>

        <article className={current.planKey === "pro" ? "plan-card current pro-offer-card" : "plan-card pro-offer-card"}>
          <p className="eyebrow">Pro IA</p>
          <h2>{tr("Le Concepteur IA prépare votre première version", "The AI Designer prepares your first version")}</h2>
          <p className="plan-price">39 € <small>/ {tr("mois", "month")}</small></p>
          <p className="annual-price">{tr("ou", "or")} 390 € / {tr("an", "year")} · 1 {tr("site", "website")}</p>
          <ul>
            <li>{tr("Tout Essentiel", "Everything in Essential")}</li>
            <li>{tr("Concepteur IA : brief → structure → contenu → raffinement", "AI Designer: brief → structure → content → refinement")}</li>
            <li>{tr("Premiers textes générés puis entièrement modifiables", "First copy generated, then fully editable")}</li>
            <li>{tr("Quotas IA supérieurs", "Higher AI quotas")}</li>
            <li>{tr("Capacité média et stockage supérieure", "Higher media and storage capacity")}</li>
            <li>{tr("Accès prioritaire aux nouveaux modules IA", "Priority access to new AI modules")}</li>
          </ul>
          <p className="plan-status">
            {betaAccess.active
              ? tr("Inclus gratuitement dans votre statut Beta Tester", "Included free with your Beta Tester status")
              : current.status === "trialing"
                ? tr("Essai Pro IA en cours", "Pro AI trial active")
                : loaded && current.planKey === "pro"
                  ? tr("Votre offre actuelle", "Your current plan")
                  : tr("14 jours d’expérience Pro IA inclus", "14 days of Pro AI included")}
          </p>
          {!betaAccess.active && current.planKey !== "pro" ? (
            <div className="builder-actions">
              <button type="button" className="button primary" disabled={Boolean(checkoutBusy)} onClick={() => void beginCheckout("pro", "monthly")}>
                {checkoutBusy === "pro:monthly" ? tr("Ouverture…", "Opening…") : tr("Essayer puis 39 €/mois", "Try then €39/month")}
              </button>
              <button type="button" className="button secondary" disabled={Boolean(checkoutBusy)} onClick={() => void beginCheckout("pro", "annual")}>
                {checkoutBusy === "pro:annual" ? tr("Ouverture…", "Opening…") : tr("Essayer puis 390 €/an", "Try then €390/year")}
              </button>
            </div>
          ) : null}
        </article>
      </section>

      <section className="panel founding-note">
        <p className="eyebrow">{tr("Bêta & lancement", "Beta & launch")}</p>
        <h2>{tr("Les testeurs ne sont pas des clients payants", "Beta testers are not paying customers")}</h2>
        <p>{tr(
          "Les proches invités à la bêta reçoivent temporairement l’accès Pro IA complet pour évaluer le produit réel. Ils peuvent supprimer leur site ensuite et ne sont engagés dans aucune offre payante. La grille Essentiel 19 € / Pro IA 39 € prépare le lancement commercial ; aucun paiement Stripe n’est activé pendant cette phase de test.",
          "People invited to beta temporarily receive full Pro AI access to evaluate the real product. They can delete their website afterwards and are not committed to any paid offer. The Essential €19 / Pro AI €39 grid prepares commercial launch; no Stripe payment is enabled during this testing phase."
        )}</p>
      </section>
    </AccountShell>
  );
}
