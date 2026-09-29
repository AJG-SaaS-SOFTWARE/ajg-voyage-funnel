"use client";

import { useEffect, useState } from "react";
import { AccountShell } from "../../components/AccountShell";
import { useUiLanguage } from "../../components/LanguageProvider";
import { downloadMySiteExport, getMyBillingState, openStripeBillingPortal, type BillingState } from "../../lib/billing-access";
import { getMySites } from "../../lib/supabase-site-repository";

function formatDate(value: string | null, locale: "fr" | "en") {
  return value ? new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { dateStyle: "long" }).format(new Date(value)) : "—";
}

export default function BillingPage() {
  const { locale } = useUiLanguage();
  const en = locale === "en";
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [message, setMessage] = useState(en ? "Loading…" : "Chargement…");
  const [sites,setSites]=useState<Array<{id:string;slug:string}>>([]);
  const [siteId,setSiteId]=useState("");
  const [billingBusy,setBillingBusy]=useState(false);

  const load=async(selectedId?:string)=>{
    const owned=await getMySites();
    const chosen=owned.find(s=>s.id===(selectedId||siteId))||owned[0];
    setSites(owned.map(s=>({id:s.id,slug:s.slug})));
    if(chosen&&!siteId)setSiteId(chosen.id);
    setBilling(chosen?await getMyBillingState(chosen.id):null);
    setMessage("");
  };

  useEffect(() => { void load().catch(() => setMessage(en ? "Billing status could not be loaded." : "Impossible de charger l’état de facturation.")); }, [en]);

  async function downloadExport() {
    try {
      await downloadMySiteExport(siteId);
      setMessage(en ? "Complete archive prepared: configuration and media files included." : "Archive complète préparée : configuration et fichiers médias inclus.");
    } catch (error) { setMessage(error instanceof Error ? error.message : (en ? "Export unavailable." : "Export impossible.")); }
  }

  async function manageBilling() {
    if (!siteId) return;
    setBillingBusy(true);
    setMessage("");
    try {
      await openStripeBillingPortal(siteId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (en ? "Stripe Billing Portal is unavailable." : "Portail Stripe indisponible."));
      setBillingBusy(false);
    }
  }

  const limited = billing && !["free","trial","active"].includes(billing.state);
  return <AccountShell
    active="billing"
    eyebrow={en ? "Billing & recovery" : "Facturation & récupération"}
    title={en ? "Your AJG Builder access" : "Votre accès AJG Builder"}
    description={en ? "Track the selected website’s payment status, restriction dates and recovery options. A failed payment never automatically deletes your data." : "Suivez l’état de paiement du site sélectionné, les éventuelles échéances de restriction et vos options de récupération. Un impayé ne déclenche jamais la suppression automatique de vos données."}
  >
    {sites.length>1?<section className="panel"><label>{en?"Website":"Site"}<select value={siteId} onChange={e=>{setSiteId(e.target.value);void load(e.target.value);}}>{sites.map(site=><option key={site.id} value={site.id}>{site.slug}</option>)}</select></label></section>:null}
    {message ? <p className="account-note">{message}</p> : null}
    {billing ? <section className="usage-card"><div><p className="eyebrow">{en?"Status":"État"}</p><h2>{billing.state}</h2>
      {limited ? <p>{en?"AI is disabled during the grace period. At restriction, editing, imports, publishing and new forms are also disabled. The public website remains online until its suspension date.":"L’IA est coupée pendant la grâce. À la restriction, l’édition, les imports, la publication et les nouveaux formulaires sont également arrêtés. Le site public reste en ligne jusqu’à sa date de suspension."}</p> : <p>{en?"Your website has its normal capabilities according to your plan.":"Votre site dispose de ses capacités normales selon votre offre."}</p>}
      <dl className="billing-dates">
        <div><dt>{en?"Grace period / restriction":"Fin de grâce / restriction"}</dt><dd>{formatDate(billing.graceUntil || billing.restrictedAt, locale)}</dd></div>
        <div><dt>{en?"Public suspension":"Suspension publique"}</dt><dd>{formatDate(billing.publicSuspendAt, locale)}</dd></div>
        <div><dt>{en?"Export available until":"Export disponible jusqu’au"}</dt><dd>{formatDate(billing.exportUntil, locale)}</dd></div>
        <div><dt>{en?"Planned recovery window end":"Fin de la fenêtre de récupération prévue"}</dt><dd>{formatDate(billing.deleteAfter, locale)}</dd></div>
      </dl>
      <div className="builder-actions">
        <button type="button" className="secondary-link" onClick={downloadExport}>{en?"Download complete archive":"Télécharger l’archive complète"}</button>
        {billing.hasBillingAccount ? (
          <button type="button" className="primary-link" disabled={billingBusy} onClick={() => void manageBilling()}>
            {billingBusy ? (en?"Opening Stripe…":"Ouverture de Stripe…") : limited ? (en?"Update payment":"Mettre à jour mon paiement") : (en?"Manage subscription":"Gérer mon abonnement")}
          </button>
        ) : null}
      </div>
      {limited && !billing.hasBillingAccount ? <p className="account-note">{en?"No Stripe account is linked to this website yet. To upgrade to Pro, use the My plan page.":"Aucun compte Stripe n’est encore rattaché à ce site. Si vous souhaitez passer à Pro, utilisez la page Mon offre."}</p> : null}
    </div></section> : null}
  </AccountShell>;
}
