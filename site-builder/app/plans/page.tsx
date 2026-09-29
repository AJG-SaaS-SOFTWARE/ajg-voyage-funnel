"use client";

import { useEffect, useState } from "react";
import { AccountShell } from "../../components/AccountShell";
import { freeEntitlements, getMyAiUsage, getMySiteEntitlements, getMyStorageUsage, type AiUsage, type StorageUsage, type SubscriptionEntitlements } from "../../lib/subscription";
import { getMySites } from "../../lib/supabase-site-repository";
import { startProCheckout } from "../../lib/billing-access";

export default function PlansPage() {
  const [current, setCurrent] = useState<SubscriptionEntitlements>(freeEntitlements);
  const [loaded, setLoaded] = useState(false);
  const [usage, setUsage] = useState<AiUsage>({ today: 0, month: 0 });
  const [storage, setStorage] = useState<StorageUsage>({ usedBytes: 0, limitMb: freeEntitlements.storageMb });
  const [sites,setSites]=useState<Array<{id:string;slug:string}>>([]);
  const [siteId,setSiteId]=useState("");
  const [checkoutBusy,setCheckoutBusy]=useState(false);
  const [checkoutMessage,setCheckoutMessage]=useState("");
  const load=async(selectedId?:string)=>{const owned=await getMySites();const site=owned.find(s=>s.id===(selectedId||siteId))||owned[0];setSites(owned.map(s=>({id:s.id,slug:s.slug})));if(site&&!siteId)setSiteId(site.id);const [entitlements,aiUsage,storageUsage]=await Promise.all([site?getMySiteEntitlements(site.id):Promise.resolve(freeEntitlements),getMyAiUsage(),getMyStorageUsage(site?.id)]);setCurrent(entitlements);setUsage(aiUsage);setStorage(storageUsage);setLoaded(true);};
  useEffect(() => { void load().catch(() => {setCurrent(freeEntitlements);setLoaded(true);}); }, []);

  const checkout=async()=>{if(!siteId)return;setCheckoutBusy(true);setCheckoutMessage("");try{await startProCheckout(siteId);}catch(error){setCheckoutMessage(error instanceof Error?error.message:"Paiement Stripe indisponible.");setCheckoutBusy(false);}};

  return <AccountShell
    active="plans"
    eyebrow="Offre & usages"
    title="Mon offre"
    description="Consultez les droits, quotas et capacités de votre site. Les règles techniques restent séparées du prix commercial et de la facturation."
  >
    {sites.length>1?<section className="panel"><label>Site<select value={siteId} onChange={e=>{setSiteId(e.target.value);void load(e.target.value);}}>{sites.map(site=><option key={site.id} value={site.id}>{site.slug}</option>)}</select></label></section>:null}
    {loaded ? <section className="usage-card" aria-label="Utilisation IA"><div><p className="eyebrow">Votre utilisation</p><h2>{usage.month} / {current.aiMonthlyLimit} générations IA ce mois-ci</h2><p>{usage.today} / {current.aiDailyLimit} aujourd’hui · limite instantanée {current.aiMinuteLimit}/min</p></div><progress max={current.aiMonthlyLimit} value={Math.min(usage.month,current.aiMonthlyLimit)} aria-label="Quota IA mensuel utilisé" /></section> : null}
    {loaded ? <section className="usage-card" aria-label="Utilisation stockage"><div><p className="eyebrow">Stockage</p><h2>{(storage.usedBytes / 1024 / 1024).toFixed(storage.usedBytes > 10 * 1024 * 1024 ? 0 : 1)} Mo / {storage.limitMb} Mo</h2><p>Photos, images, audio et documents importés dans AJG.</p></div><progress max={storage.limitMb * 1024 * 1024} value={Math.min(storage.usedBytes,storage.limitMb * 1024 * 1024)} aria-label="Quota de stockage utilisé" /></section> : null}
    {loaded && !["active","trialing"].includes(current.status) ? <section className="usage-card" role="status"><div><p className="eyebrow">Abonnement à régulariser</p><h2>Votre abonnement nécessite une régularisation</h2><p>Consultez l’espace Facturation pour connaître précisément les capacités encore disponibles et les dates de restriction, suspension publique et export. L’IA est coupée dès l’entrée en grâce ; les autres restrictions suivent les échéances affichées.</p></div></section> : null}
    <section className="plans-grid" aria-label="Offres">
      <article className={current.planKey === "free" ? "plan-card current" : "plan-card"}>
        <p className="eyebrow">Gratuit</p><h2>Créer et tester</h2>
        <ul><li>Site et sous-domaine géré</li><li>80 générations IA / mois</li><li>250 Mo de stockage</li><li>Édition et publication essentielles</li></ul>
        <p className="plan-status">{loaded && current.planKey === "free" ? (["active","trialing"].includes(current.status) ? "Votre offre actuelle" : `Accès de repli · statut ${current.status}`) : "Offre disponible"}</p>
      </article>
      <article className={current.planKey === "pro" ? "plan-card current" : "plan-card"}>
        <p className="eyebrow">Pro</p><h2>Créer avec l’IA avancée</h2>
        <ul><li>500 générations IA / mois</li><li>2 Go de stockage</li><li>Architecte Premium : stratégie → création → audit → raffinement</li><li>Architecture, textes, modules et direction visuelle cohérents</li><li>Domaine personnalisé</li></ul>
        <p className="plan-status">{loaded && current.planKey === "pro" ? "Votre offre actuelle" : "Souscription sécurisée via Stripe"}</p>
        {loaded && current.planKey !== "pro" ? <button type="button" className="button primary" disabled={!siteId || checkoutBusy} onClick={() => void checkout()}>{checkoutBusy ? "Ouverture de Stripe…" : "Passer à Pro"}</button> : null}
        {checkoutMessage ? <p className="account-note" role="status">{checkoutMessage}</p> : null}
      </article>
    </section>
    <p className="account-note">Les quotas constituent le catalogue technique. Le prix, la périodicité et un éventuel essai restent configurés dans Stripe : aucune valeur commerciale n’est codée dans le Builder.</p>
  </AccountShell>;
}
