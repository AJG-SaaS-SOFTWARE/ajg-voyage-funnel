"use client";

import { FormEvent, useEffect, useState } from "react";
import { AccountShell } from "../../components/AccountShell";
import { getMyDomains, getMySite, getMySites, removeCustomDomain, requestCustomDomain, syncSiteDomain, type SiteDomain } from "../../lib/supabase-site-repository";
import { freeEntitlements, getMySiteEntitlements, type SubscriptionEntitlements } from "../../lib/subscription";
import { useProductLocale } from "../../lib/product-i18n";

export default function DomainsPage() {
  const { tr } = useProductLocale();
  const [domains,setDomains]=useState<SiteDomain[]>([]);
  const [plan,setPlan]=useState<SubscriptionEntitlements>(freeEntitlements);
  const [hostname,setHostname]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [sites,setSites]=useState<Array<{id:string;slug:string}>>([]);
  const [siteId,setSiteId]=useState("");
  const refresh=async(selectedId?:string)=>{ const owned=await getMySites(); const chosen=owned.find(s=>s.id===(selectedId||siteId))||owned[0]; setSites(owned.map(s=>({id:s.id,slug:s.slug}))); if(chosen&&!siteId)setSiteId(chosen.id); const [items,entitlements]=await Promise.all([chosen?getMyDomains(chosen.id):Promise.resolve([]),chosen?getMySiteEntitlements(chosen.id):Promise.resolve(freeEntitlements)]); setDomains(items); setPlan(entitlements); };
  useEffect(()=>{ void refresh().catch((e)=>setMessage(e instanceof Error?e.message:tr("Impossible de charger les domaines.", "Unable to load domains."))); },[]);
  const submit=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setMessage("");try{const site=await getMySite(siteId);if(!site)throw new Error(tr("Créez d’abord votre site.", "Create your website first."));const domain=await requestCustomDomain(hostname,site.id);const result=await syncSiteDomain(site.id,domain.id);setHostname("");await refresh();setMessage(result.verified?tr("Domaine rattaché et vérifié.", "Domain connected and verified."):tr("Domaine rattaché à Vercel. Configurez les enregistrements DNS demandés puis relancez la vérification.", "Domain connected to Vercel. Configure the requested DNS records, then run verification again."));}catch(error){setMessage(error instanceof Error?error.message:tr("Impossible d’enregistrer ce domaine.", "Unable to save this domain."));}finally{setBusy(false);}};
  const verify=async(domain:SiteDomain)=>{setBusy(true);setMessage("");try{const site=await getMySite(siteId);if(!site)throw new Error(tr("Site introuvable.", "Website not found."));const result=await syncSiteDomain(site.id,domain.id);await refresh();if(result.verified)setMessage(tr("Domaine vérifié, DNS opérationnel et activé.", "Domain verified, DNS operational and activated."));else{const instructions=result.verification.map(item=>[item.type,item.domain,item.value].filter(Boolean).join(" · ")).filter(Boolean);setMessage(instructions.length?`DNS à configurer : ${instructions.join(" | ")}. Ajoutez uniquement l’enregistrement recommandé ci-dessus, puis relancez la vérification après propagation.`:result.ownershipVerified?"Domaine rattaché à Vercel, mais le DNS public n’est pas encore opérationnel. Contrôlez la configuration DNS puis réessayez.":"Vérification encore en attente. Contrôlez la configuration DNS puis réessayez.");}}catch(error){setMessage(error instanceof Error?error.message:tr("Vérification impossible.", "Verification failed."));}finally{setBusy(false);}};
  const remove=async(id:string)=>{setBusy(true);try{await removeCustomDomain(id);await refresh();}catch(error){setMessage(error instanceof Error?error.message:tr("Suppression impossible.", "Unable to remove domain."));}finally{setBusy(false);}};

  return <AccountShell
    active="domains"
    eyebrow={tr("Publication", "Publishing")}
    title={tr("Domaines", "Domains")}
    description={tr("Votre sous-domaine AJG est géré automatiquement. Avec l’offre Pro, vous pouvez aussi rattacher un domaine que vous possédez et suivre sa vérification DNS.", "Your AJG subdomain is managed automatically. With Pro, you can also connect a domain you own and track its DNS verification.")}
  >
    {sites.length>1?<section className="panel"><label>Site<select value={siteId} onChange={e=>{setSiteId(e.target.value);void refresh(e.target.value);}}>{sites.map(site=><option key={site.id} value={site.id}>{site.slug}</option>)}</select></label></section>:null}
    <section className="domain-list">{domains.map(domain=><article className="domain-row" key={domain.id}><div><b>{domain.hostname}</b><p>{domain.kind==="managed_subdomain"?tr("Sous-domaine AJG", "AJG subdomain"):tr("Domaine personnalisé", "Custom domain")} · {domain.verificationStatus==="verified"?tr("Vérifié", "Verified"):domain.verificationStatus==="failed"?tr("Échec de vérification", "Verification failed"):tr("En attente de vérification", "Verification pending")}</p></div>{domain.kind==="custom_domain"&&domain.verificationStatus!=="verified"?<div><button className="text-button" disabled={busy} onClick={()=>void verify(domain)}>{tr("Vérifier", "Verify")}</button><button className="text-button" disabled={busy} onClick={()=>void remove(domain.id)}>{tr("Retirer", "Remove")}</button></div>:domain.kind==="managed_subdomain"&&domain.verificationStatus!=="verified"?<small>{tr("Préparation en cours par AJG", "AJG setup in progress")}</small>:null}</article>)}</section>
    <form className="domain-form" onSubmit={submit}><div><p className="eyebrow">{tr("Domaine personnalisé", "Custom domain")}</p><h2>{tr("Ajouter votre domaine", "Add your domain")}</h2><p>{plan.customDomain?tr("Votre offre permet cette fonctionnalité.", "Your plan includes this feature."):tr("Disponible avec l’offre Pro.", "Available with Pro.")}</p></div><div className="domain-controls"><input value={hostname} onChange={e=>setHostname(e.target.value)} placeholder="exemple.fr" disabled={!plan.customDomain||busy}/><button className="button primary" disabled={!plan.customDomain||busy||!hostname.trim()}>{busy?tr("Enregistrement…", "Saving…"):tr("Ajouter", "Add")}</button></div></form>
    {message?<p className="account-note" role="status">{message}</p>:null}
    <p className="account-note">Le sous-domaine AJG est administré par la plateforme. Pour un domaine personnel, AJG ne le marque jamais comme vérifié au simple enregistrement : le rattachement Vercel et la vérification DNS doivent réussir avant activation.</p>
  </AccountShell>;
}