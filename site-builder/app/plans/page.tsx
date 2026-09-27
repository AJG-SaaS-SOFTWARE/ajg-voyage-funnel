"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { freeEntitlements, getMyEntitlements, type SubscriptionEntitlements } from "../../lib/subscription";

export default function PlansPage() {
  const [current, setCurrent] = useState<SubscriptionEntitlements>(freeEntitlements);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { getMyEntitlements().then(setCurrent).catch(() => setCurrent(freeEntitlements)).finally(() => setLoaded(true)); }, []);

  return <main className="plans-page">
    <section className="plans-hero">
      <p className="eyebrow">AJG Site Builder</p>
      <h1>Une offre simple aujourd’hui, prête pour la monétisation.</h1>
      <p>Les droits techniques sont déjà séparés du paiement. Les tarifs commerciaux seront branchés au prestataire de paiement sans disperser les règles dans le builder.</p>
      <Link className="button secondary" href="/builder">← Retour au builder</Link>
    </section>
    <section className="plans-grid" aria-label="Offres">
      <article className={current.planKey === "free" ? "plan-card current" : "plan-card"}>
        <p className="eyebrow">Gratuit</p><h2>Créer et tester</h2>
        <ul><li>Site et sous-domaine géré</li><li>80 générations IA / mois</li><li>250 Mo de stockage</li><li>Édition et publication essentielles</li></ul>
        <p className="plan-status">{loaded && current.planKey === "free" ? "Votre offre actuelle" : "Offre disponible"}</p>
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
