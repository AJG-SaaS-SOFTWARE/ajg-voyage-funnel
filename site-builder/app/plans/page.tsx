"use client";

import { useEffect, useState } from "react";
import { AccountShell } from "../../components/AccountShell";
import { useUiLanguage } from "../../components/LanguageProvider";
import { freeEntitlements, getMyAiUsage, getMySiteEntitlements, getMyStorageUsage, type AiUsage, type StorageUsage, type SubscriptionEntitlements } from "../../lib/subscription";
import { getMySites } from "../../lib/supabase-site-repository";
import { startProCheckout } from "../../lib/billing-access";

export default function PlansPage() {
  const { locale } = useUiLanguage();
  const en = locale === "en";
  const [current, setCurrent] = useState<SubscriptionEntitlements>(freeEntitlements);
  const [loaded, setLoaded] = useState(false);
  const [usage, setUsage] = useState<AiUsage>({ today: 0, month: 0 });
  const [storage, setStorage] = useState<StorageUsage>({ usedBytes: 0, limitMb: freeEntitlements.storageMb });
  const [sites,setSites]=useState<Array<{id:string;slug:string}>>([]);
  const [siteId,setSiteId]=useState("");
  const [checkoutBusy,setCheckoutBusy]=useState(false);
  const [checkoutMessage,setCheckoutMessage]=useState("");

  const load=async(selectedId?:string)=>{
    const owned=await getMySites();
    const site=owned.find(s=>s.id===(selectedId||siteId))||owned[0];
    setSites(owned.map(s=>({id:s.id,slug:s.slug})));
    if(site&&!siteId)setSiteId(site.id);
    const [entitlements,aiUsage,storageUsage]=await Promise.all([
      site?getMySiteEntitlements(site.id):Promise.resolve(freeEntitlements),
      getMyAiUsage(),
      getMyStorageUsage(site?.id)
    ]);
    setCurrent(entitlements);
    setUsage(aiUsage);
    setStorage(storageUsage);
    setLoaded(true);
  };

  useEffect(() => { void load().catch(() => {setCurrent(freeEntitlements);setLoaded(true);}); }, []);

  const checkout=async()=>{
    if(!siteId)return;
    setCheckoutBusy(true);
    setCheckoutMessage("");
    try{await startProCheckout(siteId);}
    catch(error){
      setCheckoutMessage(error instanceof Error?error.message:(en?"Stripe checkout is unavailable.":"Paiement Stripe indisponible."));
      setCheckoutBusy(false);
    }
  };

  return <AccountShell
    active="plans"
    eyebrow={en ? "Plan & usage" : "Offre & usages"}
    title={en ? "My plan" : "Mon offre"}
    description={en ? "Review your website entitlements, quotas and capabilities. Technical limits remain separate from commercial pricing and billing." : "Consultez les droits, quotas et capacités de votre site. Les règles techniques restent séparées du prix commercial et de la facturation."}
  >
    {sites.length>1?<section className="panel"><label>{en?"Website":"Site"}<select value={siteId} onChange={e=>{setSiteId(e.target.value);void load(e.target.value);}}>{sites.map(site=><option key={site.id} value={site.id}>{site.slug}</option>)}</select></label></section>:null}

    {loaded ? <section className="usage-card" aria-label={en?"AI usage":"Utilisation IA"}><div>
      <p className="eyebrow">{en?"Your usage":"Votre utilisation"}</p>
      <h2>{usage.month} / {current.aiMonthlyLimit} {en?"AI generations this month":"générations IA ce mois-ci"}</h2>
      <p>{usage.today} / {current.aiDailyLimit} {en?"today":"aujourd’hui"} · {en?"instant limit":"limite instantanée"} {current.aiMinuteLimit}/min</p>
    </div><progress max={current.aiMonthlyLimit} value={Math.min(usage.month,current.aiMonthlyLimit)} aria-label={en?"Monthly AI quota used":"Quota IA mensuel utilisé"} /></section> : null}

    {loaded ? <section className="usage-card" aria-label={en?"Storage usage":"Utilisation stockage"}><div>
      <p className="eyebrow">{en?"Storage":"Stockage"}</p>
      <h2>{(storage.usedBytes / 1024 / 1024).toFixed(storage.usedBytes > 10 * 1024 * 1024 ? 0 : 1)} MB / {storage.limitMb} MB</h2>
      <p>{en?"Photos, images, audio and documents imported into AJG.":"Photos, images, audio et documents importés dans AJG."}</p>
    </div><progress max={storage.limitMb * 1024 * 1024} value={Math.min(storage.usedBytes,storage.limitMb * 1024 * 1024)} aria-label={en?"Storage quota used":"Quota de stockage utilisé"} /></section> : null}

    {loaded && !["active","trialing"].includes(current.status) ? <section className="usage-card" role="status"><div>
      <p className="eyebrow">{en?"Subscription action required":"Abonnement à régulariser"}</p>
      <h2>{en?"Your subscription requires attention":"Votre abonnement nécessite une régularisation"}</h2>
      <p>{en?"Open Billing to review the remaining capabilities and the restriction, public suspension and export dates. AI is disabled as soon as the grace period starts; other restrictions follow the displayed schedule.":"Consultez l’espace Facturation pour connaître précisément les capacités encore disponibles et les dates de restriction, suspension publique et export. L’IA est coupée dès l’entrée en grâce ; les autres restrictions suivent les échéances affichées."}</p>
    </div></section> : null}

    <section className="plans-grid" aria-label={en?"Plans":"Offres"}>
      <article className={current.planKey === "free" ? "plan-card current" : "plan-card"}>
        <p className="eyebrow">{en?"Free":"Gratuit"}</p><h2>{en?"Create and test":"Créer et tester"}</h2>
        <ul>
          <li>{en?"Website and managed subdomain":"Site et sous-domaine géré"}</li>
          <li>80 {en?"AI generations / month":"générations IA / mois"}</li>
          <li>250 MB {en?"storage":"de stockage"}</li>
          <li>{en?"Core editing and publishing":"Édition et publication essentielles"}</li>
        </ul>
        <p className="plan-status">{loaded && current.planKey === "free" ? (["active","trialing"].includes(current.status) ? (en?"Your current plan":"Votre offre actuelle") : `${en?"Fallback access · status":"Accès de repli · statut"} ${current.status}`) : (en?"Available plan":"Offre disponible")}</p>
      </article>

      <article className={current.planKey === "pro" ? "plan-card current" : "plan-card"}>
        <p className="eyebrow">Pro</p><h2>{en?"Create with advanced AI":"Créer avec l’IA avancée"}</h2>
        <ul>
          <li>500 {en?"AI generations / month":"générations IA / mois"}</li>
          <li>2 GB {en?"storage":"de stockage"}</li>
          <li>{en?"Premium Architect: strategy → creation → audit → refinement":"Architecte Premium : stratégie → création → audit → raffinement"}</li>
          <li>{en?"Coherent architecture, copy, modules and visual direction":"Architecture, textes, modules et direction visuelle cohérents"}</li>
          <li>{en?"Custom domain":"Domaine personnalisé"}</li>
        </ul>
        <p className="plan-status">{loaded && current.planKey === "pro" ? (en?"Your current plan":"Votre offre actuelle") : (en?"Secure subscription via Stripe":"Souscription sécurisée via Stripe")}</p>
        {loaded && current.planKey !== "pro" ? <button type="button" className="button primary" disabled={!siteId || checkoutBusy} onClick={() => void checkout()}>{checkoutBusy ? (en?"Opening Stripe…":"Ouverture de Stripe…") : (en?"Upgrade to Pro":"Passer à Pro")}</button> : null}
        {checkoutMessage ? <p className="account-note" role="status">{checkoutMessage}</p> : null}
      </article>
    </section>

    <p className="account-note">{en?"Quotas define the technical catalog. Price, billing period and any trial remain configured in Stripe; no commercial price is hard-coded in the Builder.":"Les quotas constituent le catalogue technique. Le prix, la périodicité et un éventuel essai restent configurés dans Stripe : aucune valeur commerciale n’est codée dans le Builder."}</p>
  </AccountShell>;
}
