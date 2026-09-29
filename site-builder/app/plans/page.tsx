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

export default function PlansPage() {
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
      ? new Date(betaAccess.expiresAt).toLocaleDateString("fr-FR")
      : "";

  return (
    <AccountShell
      active="plans"
      eyebrow="Offre & usages"
      title="Mon offre"
      description="AJG ne se positionne pas comme un constructeur de sites low-cost : l’offre Pro ajoute un véritable Architecte IA qui travaille la stratégie, l’architecture, le contenu et la direction visuelle du site, tout en vous laissant le contrôle."
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
            <h2>Accès Pro complet offert pendant la bêta</h2>
            <p>
              Architecte IA Premium, domaine personnalisé, quotas Pro et toutes les
              fonctions payantes sont ouverts sans abonnement Stripe
              {betaExpiryLabel ? " jusqu’au " + betaExpiryLabel : ""}.
              À l’expiration, le site revient automatiquement à son offre réelle.
            </p>
          </div>
        </section>
      ) : null}

      {loaded ? (
        <section className="usage-card" aria-label="Utilisation IA">
          <div>
            <p className="eyebrow">Votre utilisation</p>
            <h2>
              {usage.month} / {current.aiMonthlyLimit} générations IA ce mois-ci
            </h2>
            <p>
              {usage.today} / {current.aiDailyLimit} aujourd’hui · limite instantanée{" "}
              {current.aiMinuteLimit}/min
            </p>
          </div>
          <progress
            max={current.aiMonthlyLimit}
            value={Math.min(usage.month, current.aiMonthlyLimit)}
            aria-label="Quota IA mensuel utilisé"
          />
        </section>
      ) : null}

      {loaded ? (
        <section className="usage-card" aria-label="Utilisation stockage">
          <div>
            <p className="eyebrow">Stockage</p>
            <h2>
              {(storage.usedBytes / 1024 / 1024).toFixed(
                storage.usedBytes > 10 * 1024 * 1024 ? 0 : 1
              )}{" "}
              Mo / {storage.limitMb} Mo
            </h2>
            <p>Photos, images, audio et documents importés dans AJG.</p>
          </div>
          <progress
            max={storage.limitMb * 1024 * 1024}
            value={Math.min(
              storage.usedBytes,
              storage.limitMb * 1024 * 1024
            )}
            aria-label="Quota de stockage utilisé"
          />
        </section>
      ) : null}

      {loaded && !["active", "trialing"].includes(current.status) && !betaAccess.active ? (
        <section className="usage-card" role="status">
          <div>
            <p className="eyebrow">Abonnement à régulariser</p>
            <h2>Votre abonnement nécessite une régularisation</h2>
            <p>
              Consultez l’espace Facturation pour connaître précisément les capacités
              encore disponibles et les dates de restriction, suspension publique et
              export.
            </p>
          </div>
        </section>
      ) : null}

      <section className="pricing-positioning panel">
        <p className="eyebrow">Positionnement AJG</p>
        <h2>Deux niveaux d’aide IA, une même base de contrôle</h2>
        <p>
          L’IA standard vous aide à rédiger, reformuler, structurer des rubriques et
          avancer champ par champ. L’Architecte Premium va plus loin : il analyse le
          projet, construit la stratégie et l’arborescence, produit une proposition
          cohérente puis la contrôle et la raffine avant application.
        </p>
        <blockquote>
          Votre site ne commence pas par un template. Il commence par votre activité.
        </blockquote>
      </section>

      <section className="plans-grid plans-grid-three" aria-label="Offres AJG">
        <article className={!betaAccess.active && current.planKey === "free" ? "plan-card current" : "plan-card"}>
          <p className="eyebrow">Gratuit</p>
          <h2>Créer et tester</h2>
          <p className="plan-price">0 €</p>
          <ul>
            <li>1 site sur sous-domaine AJG</li>
            <li>IA standard : rédaction, reformulation, mode guidé et rubriques</li>
            <li>80 générations IA / mois</li>
            <li>250 Mo de stockage</li>
            <li>Édition et publication essentielles</li>
            <li>Architecte IA Premium non inclus</li>
          </ul>
          <p className="plan-status">
            {loaded && !betaAccess.active && current.planKey === "free"
              ? "Votre offre actuelle"
              : "Offre d’entrée"}
          </p>
        </article>

        <article className="plan-card plan-card-roadmap">
          <p className="eyebrow">Essential · trajectoire</p>
          <h2>Construire avec l’aide de l’IA</h2>
          <p className="plan-price">Tarif à tester après la bêta</p>
          <ul>
            <li>1 site professionnel</li>
            <li>Domaine personnalisé prévu</li>
            <li>IA standard avec quotas plus généreux</li>
            <li>Éditeur, personnalisation et publication complets</li>
            <li>Sans Architecte IA Premium</li>
          </ul>
          <p className="plan-status">
            Offre conservée dans la gamme cible, mais volontairement non commercialisée
            avant les retours des testeurs.
          </p>
        </article>

        <article className={current.planKey === "pro" ? "plan-card current pro-offer-card" : "plan-card pro-offer-card"}>
          <p className="eyebrow">Founding Pro</p>
          <h2>L’IA conçoit le site avec vous</h2>
          <p className="plan-price">
            24,90 € <small>/ mois</small>
          </p>
          <p className="annual-price">ou 239 € / an · 1 site</p>
          <ul>
            <li>Tout ce qui est prévu dans Essential</li>
            <li>500 générations IA / mois</li>
            <li>2 Go de stockage</li>
            <li>Architecte Premium : stratégie → architecture → création → audit → raffinement</li>
            <li>Architecture, textes, modules et direction visuelle cohérents</li>
            <li>Domaine personnalisé</li>
          </ul>
          <p className="plan-status">
            {betaAccess.active
              ? "Inclus gratuitement dans votre statut Beta Tester"
              : loaded && current.planKey === "pro"
                ? "Votre offre actuelle"
                : "Offre Founding prévue pour les 10 premiers clients payants"}
          </p>
          {!betaAccess.active && current.planKey !== "pro" ? (
            <button type="button" className="button primary" disabled>
              Souscription ouverte après la bêta
            </button>
          ) : null}
        </article>
      </section>

      <section className="panel founding-note">
        <p className="eyebrow">Bêta & lancement</p>
        <h2>Les testeurs ne sont pas des clients payants</h2>
        <p>
          Les proches invités à la bêta reçoivent temporairement l’accès Pro complet
          pour évaluer le produit réel. Ils peuvent supprimer leur site ensuite et ne
          sont pas engagés dans l’offre Founding. Le tarif Founding sera testé au
          lancement commercial ; Essential sera décidé à partir des usages observés.
        </p>
      </section>
    </AccountShell>
  );
}
