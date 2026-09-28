"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { exportMySiteData, getMyBillingState, type BillingState } from "../../lib/billing-access";

function date(value: string | null) {
  return value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(value)) : "—";
}

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [message, setMessage] = useState("Chargement…");

  useEffect(() => {
    getMyBillingState().then((value) => { setBilling(value); setMessage(""); }).catch(() => setMessage("Impossible de charger l’état de facturation."));
  }, []);

  async function downloadExport() {
    try {
      const payload = await exportMySiteData();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `ajg-builder-export-${payload.site.slug}.json`; a.click();
      URL.revokeObjectURL(url); setMessage("Export préparé.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Export impossible."); }
  }

  const limited = billing && !["free","trial","active"].includes(billing.state);
  return <main className="plans-page">
    <section className="plans-hero"><p className="eyebrow">Facturation & récupération</p><h1>Votre accès AJG Builder</h1>
      <p>Les restrictions sont appliquées au site concerné. Vos données ne sont jamais supprimées au premier échec de paiement.</p>
      <div className="builder-actions"><Link className="secondary-link" href="/builder">Retour au Builder</Link><Link className="secondary-link" href="/plans">Voir mon offre</Link></div>
    </section>
    {message ? <p className="plans-note">{message}</p> : null}
    {billing ? <section className="usage-card"><div><p className="eyebrow">État</p><h2>{billing.state}</h2>
      {limited ? <p>L’IA est coupée pendant la grâce. À la restriction, l’édition, les imports, la publication et les nouveaux formulaires sont également arrêtés. Le site public reste en ligne jusqu’à sa date de suspension.</p> : <p>Votre site dispose de ses capacités normales selon votre offre.</p>}
      <dl className="billing-dates"><div><dt>Fin de grâce / restriction</dt><dd>{date(billing.graceUntil || billing.restrictedAt)}</dd></div><div><dt>Suspension publique</dt><dd>{date(billing.publicSuspendAt)}</dd></div><div><dt>Export disponible jusqu’au</dt><dd>{date(billing.exportUntil)}</dd></div><div><dt>Suppression contrôlée après</dt><dd>{date(billing.deleteAfter)}</dd></div></dl>
      <div className="builder-actions"><button type="button" className="secondary-link" onClick={downloadExport}>Exporter mes données</button>{limited ? <button type="button" className="primary-link" disabled title="Le portail de paiement sera activé avec Stripe.">Mettre à jour mon paiement</button> : null}</div>
      {limited ? <p className="plans-note">Le bouton de règlement sera activé uniquement lorsque le portail de paiement signé sera connecté. Aucun paiement n’est simulé pendant la bêta.</p> : null}
    </div></section> : null}
  </main>;
}
