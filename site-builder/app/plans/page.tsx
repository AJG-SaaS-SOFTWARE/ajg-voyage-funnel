"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { freeEntitlements, getMyAiUsage, getMyEntitlements, getMyStorageUsage, type AiUsage, type StorageUsage, type SubscriptionEntitlements } from "../../lib/subscription";

export default function PlansPage() {
  const [current, setCurrent] = useState<SubscriptionEntitlements>(freeEntitlements);
  const [loaded, setLoaded] = useState(false);
  const [usage, setUsage] = useState<AiUsage>({ today: 0, month: 0 });
  const [storage, setStorage] = useState<StorageUsage>({ usedBytes: 0, limitMb: freeEntitlements.storageMb });
  useEffect(() => {
    Promise.all([getMyEntitlements(), getMyAiUsage(), getMyStorageUsage()])
      .then(([entitlements, aiUsage, storageUsage]) => { setCurrent(entitlements); setUsage(aiUsage); setStorage(storageUsage); })
      .catch(() => setCurrent(freeEntitlements))
      .finally(() => setLoaded(true));
  }, []);

  return <main className="plans-page">
    <section className="plans-hero">
      <p className="eyebrow">AJG Site Builder</p>
      <h1>Une offre simple aujourd’hui, prête pour la monétisation.</h1>
      <p>Les droits techniques sont déjà séparés du paiement. Les tarifs commerciaux seront branchés au prestataire de paiement sans disperser les règles dans le builder.</p>
      <Link className="button secondary" href="/builder">← Retour au builder</Link>
    </section>
    {loaded ? <section className="usage-card" aria-label="Utilisation IA"><div><p className="eyebrow">Votre utilisation</p><h2>{usage.month} / {current.aiMonthlyLimit} générations IA ce mois-ci</h2><p>{usage.today} / {current.aiDailyLimit} aujourd’hui · limite instantanée {current.aiMinuteLimit}/min</p></div><progress max={current.aiMonthlyLimit} value={Math.min(usage.month,current.aiMonthlyLimit)} aria-label="Quota IA mensuel utilisé" /></section> : null}
    {loaded ? <section className="usage-card" aria-label="Utilisation stockage"><div><p className="eyebrow">Stockage</p><h2>{(storage.usedBytes / 1024 / 1024).toFixed(storage.usedBytes > 10 * 1024 * 1024 ? 0 : 1)} Mo / {storage.limitMb} Mo</h2><p>Photos, images, audio et documents importés dans AJG.</p></div><progress max={storage.limitMb * 1024 * 1024} value={Math.min(storage.usedBytes,storage.limitMb * 1024 * 1024)} aria-label="Quota de stockage utilisé" /></section> : null}
    {loaded && !["active","trialing"].includes(current.status) ? <section className="usage-card" role="status"><div><p className="eyebrow">Abonnement à régulariser</p><h2>Les fonctions Premium sont temporairement désactivées</h2><p>Vous conservez l’accès à votre espace et à vos données. Une nouvelle publication est bloquée jusqu’à régularisation ; les modalités définitives de grâce et de suspension seront appliquées lors de la connexion du paiement.</p></div></section> : null}\n    <section className="plans-grid" aria-label="Offres">
      <article className={current.planKey === "free" ? "plan-card current" : "plan-card"}>
        <p className="eyebrow">Gratuit</p><h2>Créer et tester</h2>
        <ul><li>Site et sous-domaine géré</li><li>80 générations IA / mois</li><li>250 Mo de stockage</li><li>Édition et publication essentielles</li></ul>
        <p className="plan-status">{loaded && current.planKey === "free" ? (["active","trialing"].includes(current.status) ? "Votre offre actuelle" : `Accès de repli · statut ${current.status}`) : "Offre disponible"}</p>
      </article>
      <article className={current.planKey === "pro" ? "plan-card current" : "plan-card"}>
        <p className="eyebrow">Pro</p><h2>Créer avec l’IA avancée</h2>
        <ul><li>500 générations IA / mois</li><li>2 Go de stockage</li><li>AI Site Architect Premium</li><li>Domaine personnalisé</li></ul>
        <p className="plan-status">{loaded && current.planKey === "pro" ? "Votre offre actuelle" : "Paiement à connecter — aucun achat possible pour le moment"}</p>
      </article>
    </section>
    <p className="plans-note">Les quotas constituent le catalogue bêta technique. Le prix, la périodicité, les essais et les conditions commerciales seront validés avant activation du paiement.</p>
  </main>;
}
