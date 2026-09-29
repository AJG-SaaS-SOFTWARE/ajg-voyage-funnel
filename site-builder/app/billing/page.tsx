"use client";

import { useEffect, useState } from "react";
import { AccountShell } from "../../components/AccountShell";
import { downloadMySiteExport, getMyBillingState, openStripeBillingPortal, type BillingState } from "../../lib/billing-access";
import { getMySites } from "../../lib/supabase-site-repository";
import { useProductLocale } from "../../lib/product-i18n";

function date(value: string | null, locale: string) {
  return value ? new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { dateStyle: "long" }).format(new Date(value)) : "—";
}

export default function BillingPage() {
  const { locale, tr } = useProductLocale();
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [message, setMessage] = useState("");
  const [sites,setSites]=useState<Array<{id:string;slug:string}>>([]);
  const [siteId,setSiteId]=useState("");
  const [billingBusy,setBillingBusy]=useState(false);

  const load=async(selectedId?:string)=>{const owned=await getMySites();const chosen=owned.find(s=>s.id===(selectedId||siteId))||owned[0];setSites(owned.map(s=>({id:s.id,slug:s.slug})));if(chosen&&!siteId)setSiteId(chosen.id);setBilling(chosen?await getMyBillingState(chosen.id):null);setMessage("");};
  useEffect(() => { void load().catch(() => setMessage(tr("Impossible de charger l’état de facturation.", "Unable to load billing status."))); }, []);

  async function downloadExport() {
    try {
      await downloadMySiteExport(siteId);
      setMessage(tr("Archive complète préparée : configuration et fichiers médias inclus.", "Full archive prepared: configuration and media files included."));
    } catch (error) { setMessage(error instanceof Error ? error.message : tr("Export impossible.", "Export unavailable.")); }
  }

  async function manageBilling() {
    if (!siteId) return;
    setBillingBusy(true);
    setMessage("");
    try {
      await openStripeBillingPortal(siteId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : tr("Portail Stripe indisponible.", "Stripe portal unavailable."));
      setBillingBusy(false);
    }
  }

  const limited = billing && !["free","trial","active"].includes(billing.state);
  return <AccountShell
    active="billing"
    eyebrow={tr("Facturation & récupération", "Billing & recovery")}
    title={tr("Votre accès AJG Builder", "Your AJG Builder access")}
    description={tr("Suivez l’état de paiement du site sélectionné, les éventuelles échéances de restriction et vos options de récupération. Un impayé ne déclenche jamais la suppression automatique de vos données.", "Track the selected website’s billing status, any restriction deadlines and your recovery options. A failed payment never triggers automatic deletion of your data.")}
  >
    {sites.length>1?<section className="panel"><label>Site<select value={siteId} onChange={e=>{setSiteId(e.target.value);void load(e.target.value);}}>{sites.map(site=><option key={site.id} value={site.id}>{site.slug}</option>)}</select></label></section>:null}
    {message ? <p className="account-note">{message}</p> : null}
    {billing ? <section className="usage-card"><div><p className="eyebrow">{tr("État", "Status")}</p><h2>{billing.state}</h2>
      {limited ? <p>{tr("L’IA est coupée pendant la grâce. À la restriction, l’édition, les imports, la publication et les nouveaux formulaires sont également arrêtés. Le site public reste en ligne jusqu’à sa date de suspension.", "AI is disabled during the grace period. Once restricted, editing, imports, publishing and new forms are also disabled. The public website remains online until its suspension date.")}</p> : <p>{tr("Votre site dispose de ses capacités normales selon votre offre.", "Your website has its normal capabilities according to your plan.")}</p>}
      <dl className="billing-dates"><div><dt>{tr("Fin de grâce / restriction", "End of grace / restriction")}</dt><dd>{date(billing.graceUntil || billing.restrictedAt, locale)}</dd></div><div><dt>{tr("Suspension publique", "Public suspension")}</dt><dd>{date(billing.publicSuspendAt, locale)}</dd></div><div><dt>{tr("Export disponible jusqu’au", "Export available until")}</dt><dd>{date(billing.exportUntil, locale)}</dd></div><div><dt>{tr("Fin de la fenêtre de récupération prévue", "Planned recovery window end")}</dt><dd>{date(billing.deleteAfter, locale)}</dd></div></dl>
      <div className="builder-actions">
        <button type="button" className="secondary-link" onClick={downloadExport}>{tr("Télécharger l’archive complète", "Download full archive")}</button>
        {billing.hasBillingAccount ? (
          <button type="button" className="primary-link" disabled={billingBusy} onClick={() => void manageBilling()}>
            {billingBusy ? tr("Ouverture de Stripe…", "Opening Stripe…") : limited ? tr("Mettre à jour mon paiement", "Update payment") : tr("Gérer mon abonnement", "Manage subscription")}
          </button>
        ) : null}
      </div>
      {limited && !billing.hasBillingAccount ? <p className="account-note">{tr("Aucun compte Stripe n’est encore rattaché à ce site. Si vous souhaitez souscrire à Essentiel ou Growth, utilisez la page Mon offre.", "No Stripe account is linked to this website yet. To subscribe to Essential or Growth, use the My plan page.")}</p> : null}
    </div></section> : null}
  </AccountShell>;
}
