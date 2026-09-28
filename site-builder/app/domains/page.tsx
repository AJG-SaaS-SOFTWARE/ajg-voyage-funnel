"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { getMyDomains, getMySite, removeCustomDomain, requestCustomDomain, syncCustomDomain, type SiteDomain } from "../../lib/supabase-site-repository";
import { freeEntitlements, getMySiteEntitlements, type SubscriptionEntitlements } from "../../lib/subscription";

export default function DomainsPage() {
  const [domains,setDomains]=useState<SiteDomain[]>([]);
  const [plan,setPlan]=useState<SubscriptionEntitlements>(freeEntitlements);
  const [hostname,setHostname]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const refresh=async()=>{ const site=await getMySite(); const [items,entitlements]=await Promise.all([getMyDomains(),site?getMySiteEntitlements(site.id):Promise.resolve(freeEntitlements)]); setDomains(items); setPlan(entitlements); };
  useEffect(()=>{ void refresh().catch((e)=>setMessage(e instanceof Error?e.message:"Impossible de charger les domaines.")); },[]);
  const submit=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setMessage("");try{const site=await getMySite();if(!site)throw new Error("Créez d’abord votre site.");const domain=await requestCustomDomain(hostname);const result=await syncCustomDomain(site.id,domain.id);setHostname("");await refresh();setMessage(result.verified?"Domaine rattaché et vérifié.":"Domaine rattaché à Vercel. Configurez les enregistrements DNS demandés puis relancez la vérification.");}catch(error){setMessage(error instanceof Error?error.message:"Impossible d’enregistrer ce domaine.");}finally{setBusy(false);}};
  const remove=async(id:string)=>{setBusy(true);try{await removeCustomDomain(id);await refresh();}catch(error){setMessage(error instanceof Error?error.message:"Suppression impossible.");}finally{setBusy(false);}};

  return <main className="plans-page">
    <section className="plans-hero"><p className="eyebrow">Publication</p><h1>Domaines</h1><p>Votre sous-domaine AJG est géré automatiquement. Un domaine que vous possédez peut être préparé ici avec l’offre Pro, puis vérifié avant de devenir public.</p><Link className="button secondary" href="/builder">← Retour au builder</Link></section>
    <section className="domain-list">{domains.map(domain=><article className="domain-row" key={domain.id}><div><b>{domain.hostname}</b><p>{domain.kind==="managed_subdomain"?"Sous-domaine AJG":"Domaine personnalisé"} · {domain.verificationStatus==="verified"?"Vérifié":domain.verificationStatus==="failed"?"Échec de vérification":"En attente de vérification"}</p></div>{domain.kind==="custom_domain"&&domain.verificationStatus!=="verified"?<button className="text-button" disabled={busy} onClick={()=>void remove(domain.id)}>Retirer</button>:null}</article>)}</section>
    <form className="domain-form" onSubmit={submit}><div><p className="eyebrow">Domaine personnalisé</p><h2>Ajouter votre domaine</h2><p>{plan.customDomain?"Votre offre permet cette fonctionnalité.":"Disponible avec l’offre Pro."}</p></div><div className="domain-controls"><input value={hostname} onChange={e=>setHostname(e.target.value)} placeholder="exemple.fr" disabled={!plan.customDomain||busy}/><button className="button primary" disabled={!plan.customDomain||busy||!hostname.trim()}>{busy?"Enregistrement…":"Ajouter"}</button></div></form>
    {message?<p className="plans-note" role="status">{message}</p>:null}
    <p className="plans-note">AJG ne marque jamais un domaine comme vérifié au simple enregistrement : la vérification DNS et le rattachement Vercel doivent réussir avant activation.</p>
  </main>;
}