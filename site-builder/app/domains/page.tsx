"use client";

import { FormEvent, useEffect, useState } from "react";
import { AccountShell } from "../../components/AccountShell";
import { getMyDomains, getMySite, getMySites, removeCustomDomain, requestCustomDomain, syncSiteDomain, type SiteDomain } from "../../lib/supabase-site-repository";
import { freeEntitlements, getMySiteEntitlements, type SubscriptionEntitlements } from "../../lib/subscription";

export default function DomainsPage() {
  const [domains,setDomains]=useState<SiteDomain[]>([]);
  const [plan,setPlan]=useState<SubscriptionEntitlements>(freeEntitlements);
  const [hostname,setHostname]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [sites,setSites]=useState<Array<{id:string;slug:string}>>([]);
  const [siteId,setSiteId]=useState("");
  const refresh=async(selectedId?:string)=>{ const owned=await getMySites(); const chosen=owned.find(s=>s.id===(selectedId||siteId))||owned[0]; setSites(owned.map(s=>({id:s.id,slug:s.slug}))); if(chosen&&!siteId)setSiteId(chosen.id); const [items,entitlements]=await Promise.all([chosen?getMyDomains(chosen.id):Promise.resolve([]),chosen?getMySiteEntitlements(chosen.id):Promise.resolve(freeEntitlements)]); setDomains(items); setPlan(entitlements); };
  useEffect(()=>{ void refresh().catch((e)=>setMessage(e instanceof Error?e.message:"Impossible de charger les domaines.")); },[]);
  const submit=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setMessage("");try{const site=await getMySite(siteId);if(!site)throw new Error("Créez d’abord votre site.");const domain=await requestCustomDomain(hostname,site.id);const result=await syncSiteDomain(site.id,domain.id);setHostname("");await refresh();setMessage(result.verified?"Domaine rattaché et vérifié.":"Domaine rattaché à Vercel. Configurez les enregistrements DNS demandés puis relancez la vérification.");}catch(error){setMessage(error instanceof Error?error.message:"Impossible d’enregistrer ce domaine.");}finally{setBusy(false);}};
  const verify=async(domain:SiteDomain)=>{setBusy(true);setMessage("");try{const site=await getMySite(siteId);if(!site)throw new Error("Site introuvable.");const result=await syncSiteDomain(site.id,domain.id);await refresh();if(result.verified)setMessage("Domaine vérifié, DNS opérationnel et activé.");else{const instructions=result.verification.map(item=>[item.type,item.domain,item.value].filter(Boolean).join(" · ")).filter(Boolean);setMessage(instructions.length?`DNS à configurer : ${instructions.join(" | ")}. Ajoutez uniquement l’enregistrement recommandé ci-dessus, puis relancez la vérification après propagation.`:result.ownershipVerified?"Domaine rattaché à Vercel, mais le DNS public n’est pas encore opérationnel. Contrôlez la configuration DNS puis réessayez.":"Vérification encore en attente. Contrôlez la configuration DNS puis réessayez.");}}catch(error){setMessage(error instanceof Error?error.message:"Vérification impossible.");}finally{setBusy(false);}};
  const remove=async(id:string)=>{setBusy(true);try{await removeCustomDomain(id);await refresh();}catch(error){setMessage(error instanceof Error?error.message:"Suppression impossible.");}finally{setBusy(false);}};

  return <AccountShell
    active="domains"
    eyebrow="Publication"
    title="Domaines"
    description="Votre sous-domaine AJG est géré automatiquement. Avec l’offre Pro, vous pouvez aussi rattacher un domaine que vous possédez et suivre sa vérification DNS."
  >
    {sites.length>1?<section className="panel"><label>Site<select value={siteId} onChange={e=>{setSiteId(e.target.value);void refresh(e.target.value);}}>{sites.map(site=><option key={site.id} value={site.id}>{site.slug}</option>)}</select></label></section>:null}
    <section className="domain-list">{domains.map(domain=><article className="domain-row" key={domain.id}><div><b>{domain.hostname}</b><p>{domain.kind==="managed_subdomain"?"Sous-domaine AJG":"Domaine personnalisé"} · {domain.verificationStatus==="verified"?"Vérifié":domain.verificationStatus==="failed"?"Échec de vérification":"En attente de vérification"}</p></div>{domain.kind==="custom_domain"&&domain.verificationStatus!=="verified"?<div><button className="text-button" disabled={busy} onClick={()=>void verify(domain)}>Vérifier</button><button className="text-button" disabled={busy} onClick={()=>void remove(domain.id)}>Retirer</button></div>:domain.kind==="managed_subdomain"&&domain.verificationStatus!=="verified"?<small>Préparation en cours par AJG</small>:null}</article>)}</section>
    <form className="domain-form" onSubmit={submit}><div><p className="eyebrow">Domaine personnalisé</p><h2>Ajouter votre domaine</h2><p>{plan.customDomain?"Votre offre permet cette fonctionnalité.":"Disponible avec l’offre Pro."}</p></div><div className="domain-controls"><input value={hostname} onChange={e=>setHostname(e.target.value)} placeholder="exemple.fr" disabled={!plan.customDomain||busy}/><button className="button primary" disabled={!plan.customDomain||busy||!hostname.trim()}>{busy?"Enregistrement…":"Ajouter"}</button></div></form>
    {message?<p className="account-note" role="status">{message}</p>:null}
    <p className="account-note">Le sous-domaine AJG est administré par la plateforme. Pour un domaine personnel, AJG ne le marque jamais comme vérifié au simple enregistrement : le rattachement Vercel et la vérification DNS doivent réussir avant activation.</p>
  </AccountShell>;
}