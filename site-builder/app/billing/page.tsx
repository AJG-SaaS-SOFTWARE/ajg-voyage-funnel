"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { downloadMySiteExport, getMyBillingState, type BillingState } from "../../lib/billing-access";
import { getMySites } from "../../lib/supabase-site-repository";

function date(value: string | null) {
  return value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(value)) : "—";
}

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [message, setMessage] = useState("Chargement…");
  const [sites,setSites]=useState<Array<{id:string;slug:string}>>([]);
  const [siteId,setSiteId]=useState("");

  const load=async(selectedId?:string)=>{const owned=await getMySites();const chosen=owned.find(s=>s.id===(selectedId||siteId))||owned[0];setSites(owned.map(s=>({id:s.id,slug:s.slug})));if(chosen&&!siteId)setSiteId(chosen.id);setBilling(chosen?await getMyBillingState(chosen.id):null);setMessage("");};
  useEffect(() => { void load().catch(() => setMessage("Impossible de charger l’état de facturation.")); }, []);

  async function downloadExport() {
    try {
      await downloadMySiteExport(siteId);
      setMessage("Archive complète préparée : configuration et fichiers médias inclus.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Export impossible."); }
  }

  const limited = billing && !["free","trial","active"].includes(billing.state);
  return <main className="plans-page">
    <section className="plans-hero"><p className="eyebrow">Facturation & récupération</p><h1>Votre accès AJG Builder</h1>
      <p>Les restrictions sont appliquées au site concerné. Vos données ne sont jamais supprimées au premier échec de paiement et aucune suppression automatique n’est déclenchée par les rappels de facturation.</p>
      <div className="builder-actions"><Link className="secondary-link" href="/builder">Retour au Builder</Link><Link className="secondary-link" href="/plans">Voir mon offre</Link></div>
    </section>
    {sites.length>1?<section className="panel"><label>Site<select value={siteId} onChange={e=>{setSiteId(e.target.value);void load(e.target.value);}}>{sites.map(site=><option key={site.id} value={site.id}>{site.slug}</option>)}</select></label></section>:null}
    {message ? <p className="plans-note">{message}</p> : null}
    {billing ? <section className="usage-card"><div><p className="eyebrow">État</p><h2>{billing.state}</h2>
      {limited ? <p>L’IA est coupée pendant la grâce. À la restriction, l’édition, les imports, la publication et les nouveaux formulaires sont également arrêtés. Le site public reste en ligne jusqu’à sa date de suspension.</p> : <p>Votre site dispose de ses capacités normales selon votre offre.</p>}
      <dl className="billing-dates"><div><dt>Fin de grâce / restriction</dt><dd>{date(billing.graceUntil || billing.restrictedAt)}</dd></div><div><dt>Suspension publique</dt><dd>{date(billing.publicSuspendAt)}</dd></div><div><dt>Export disponible jusqu’au</dt><dd>{date(billing.exportUntil)}</dd></div><div><dt>Fin de la fenêtre de récupération prévue</dt><dd>{date(billing.deleteAfter)}</dd></div></dl>
      <div className="builder-actions"><button type="button" className="secondary-link" onClick={downloadExport}>Télécharger l’archive complète</button>{limited ? <button type="button" className="primary-link" disabled title="Le portail de paiement sera activé avec Stripe.">Mettre à jour mon paiement</button> : null}</div>
      {limited ? <p className="plans-note">Le bouton de règlement sera activé uniquement lorsque le portail de paiement signé sera connecté. Aucun paiement n’est simulé pendant la bêta.</p> : null}
    </div></section> : null}
  </main>;
}
