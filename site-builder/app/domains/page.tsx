"use client";

import { FormEvent, useEffect, useState } from "react";
import { AccountShell } from "../../components/AccountShell";
import { getMyDomains, getMySite, getMySites, removeCustomDomain, requestCustomDomain, syncSiteDomain, type SiteDomain } from "../../lib/supabase-site-repository";
import { freeEntitlements, getMySiteEntitlements, type SubscriptionEntitlements } from "../../lib/subscription";
import { useProductLocale } from "../../lib/product-i18n";
import { domainGuide } from "../../lib/domain-guidance";

export default function DomainsPage() {
  const { locale, tr } = useProductLocale();
  const [domains,setDomains]=useState<SiteDomain[]>([]);
  const [plan,setPlan]=useState<SubscriptionEntitlements>(freeEntitlements);
  const [hostname,setHostname]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [sites,setSites]=useState<Array<{id:string;slug:string}>>([]);
  const [siteId,setSiteId]=useState("");
  const refresh=async(selectedId?:string)=>{ const owned=await getMySites(); const chosen=owned.find(s=>s.id===(selectedId||siteId))||owned[0]; setSites(owned.map(s=>({id:s.id,slug:s.slug}))); if(chosen&&!siteId)setSiteId(chosen.id); const [items,entitlements]=await Promise.all([chosen?getMyDomains(chosen.id):Promise.resolve([]),chosen?getMySiteEntitlements(chosen.id):Promise.resolve(freeEntitlements)]); setDomains(items); setPlan(entitlements); };
  useEffect(()=>{ void refresh().catch((e)=>setMessage(e instanceof Error?e.message:tr("Impossible de charger les domaines. Actualisez la page ; si le problème persiste, ouvrez le Health Center.", "Unable to load domains. Refresh the page; if the issue persists, open the Health Center."))); },[]);
  const submit=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setMessage("");try{const site=await getMySite(siteId);if(!site)throw new Error(tr("Créez d’abord votre site.", "Create your website first."));const domain=await requestCustomDomain(hostname,site.id);const result=await syncSiteDomain(site.id,domain.id);setHostname("");await refresh();setMessage(result.verified?tr("Domaine rattaché et vérifié.", "Domain connected and verified."):tr("Domaine rattaché à Vercel. Configurez les enregistrements DNS demandés puis relancez la vérification.", "Domain connected to Vercel. Configure the requested DNS records, then run verification again."));}catch(error){setMessage(error instanceof Error?error.message:tr("Impossible d’enregistrer ce domaine. Vérifiez le nom saisi et votre connexion, puis réessayez.", "Unable to save this domain. Check the domain name and your connection, then try again."));}finally{setBusy(false);}};
  const verify=async(domain:SiteDomain)=>{setBusy(true);setMessage("");try{const site=await getMySite(siteId);if(!site)throw new Error(tr("Site introuvable.", "Website not found."));const result=await syncSiteDomain(site.id,domain.id);await refresh();if(result.verified)setMessage(tr("Domaine vérifié, DNS opérationnel et activé.", "Domain verified, DNS operational and activated."));else{const instructions=result.verification.map(item=>[item.type,item.domain,item.value].filter(Boolean).join(" · ")).filter(Boolean);setMessage(instructions.length?`${tr("DNS à configurer :", "DNS to configure:")} ${instructions.join(" | ")}. ${tr("Ajoutez uniquement l’enregistrement recommandé ci-dessus, puis relancez la vérification après propagation.", "Add only the recommended record above, then run verification again after DNS propagation.")}`:result.ownershipVerified?tr("Domaine rattaché à Vercel, mais le DNS public n’est pas encore opérationnel. Contrôlez la configuration DNS puis réessayez.", "Domain connected to Vercel, but public DNS is not operational yet. Check the DNS configuration and try again."):tr("Vérification encore en attente. Contrôlez la configuration DNS puis réessayez.", "Verification is still pending. Check the DNS configuration and try again."));}}catch(error){setMessage(error instanceof Error?error.message:tr("Vérification impossible. Contrôlez les enregistrements DNS affichés puis relancez la vérification après propagation.", "Verification failed. Check the displayed DNS records, then run verification again after propagation."));}finally{setBusy(false);}};
  const remove=async(id:string)=>{setBusy(true);try{await removeCustomDomain(id);await refresh();}catch(error){setMessage(error instanceof Error?error.message:tr("Suppression impossible. Actualisez la liste puis réessayez ; le domaine reste inchangé tant que l’opération n’a pas réussi.", "Unable to remove domain. Refresh the list and try again; the domain remains unchanged until the operation succeeds."));}finally{setBusy(false);}};

  const managedDomain = domains.find(domain => domain.kind === "managed_subdomain") || null;
  const customDomain = domains.find(domain => domain.kind === "custom_domain") || null;
  const guide = domainGuide({
    customDomainAllowed: plan.customDomain,
    managedStatus: managedDomain?.verificationStatus || null,
    customStatus: customDomain?.verificationStatus || null
  });

  return <AccountShell
    active="domains"
    eyebrow={tr("Publication", "Publishing")}
    title={tr("Domaines", "Domains")}
    description={tr("Votre sous-domaine ELTARA est géré automatiquement. Essentiel et Growth permettent aussi de rattacher un domaine que vous possédez et de suivre sa vérification DNS.", "Your ELTARA subdomain is managed automatically. Essential and Growth also let you connect a domain you own and track its DNS verification.")}
  >
    <section className="panel domain-guide" aria-labelledby="domain-guide-title">
      <p className="eyebrow">{tr("Parcours guidé", "Guided setup")}</p>
      <h2 id="domain-guide-title">{tr("Mettre votre domaine en ligne, étape par étape", "Put your domain online, step by step")}</h2>
      <p>{tr(
        "ELTARA indique la prochaine action utile. Ne modifiez pas d’autres enregistrements DNS que ceux explicitement demandés.",
        "ELTARA shows the next useful action. Do not change DNS records other than those explicitly requested."
      )}</p>
      <ol className="domain-guide-steps">
        {guide.map((step, index) => (
          <li className={`domain-guide-step ${step.status}`} key={step.key}>
            <span aria-hidden="true">{step.status === "done" ? "✓" : index + 1}</span>
            <div>
              <b>{locale === "en" ? step.titleEn : step.titleFr}</b>
              <p>{locale === "en" ? step.detailEn : step.detailFr}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
    {sites.length>1?<section className="panel"><label>Site<select value={siteId} onChange={e=>{setSiteId(e.target.value);void refresh(e.target.value);}}>{sites.map(site=><option key={site.id} value={site.id}>{site.slug}</option>)}</select></label></section>:null}
    <section className="domain-list">{domains.map(domain=><article className="domain-row" key={domain.id}><div><b>{domain.hostname}</b><p>{domain.kind==="managed_subdomain"?tr("Sous-domaine ELTARA", "ELTARA subdomain"):tr("Domaine personnalisé", "Custom domain")} · {domain.verificationStatus==="verified"?tr("Vérifié", "Verified"):domain.verificationStatus==="failed"?tr("Échec de vérification", "Verification failed"):tr("En attente de vérification", "Verification pending")}</p></div>{domain.kind==="custom_domain"&&domain.verificationStatus!=="verified"?<div><button className="text-button" disabled={busy} onClick={()=>void verify(domain)}>{tr("Vérifier", "Verify")}</button><button className="text-button" disabled={busy} onClick={()=>void remove(domain.id)}>{tr("Retirer", "Remove")}</button></div>:domain.kind==="managed_subdomain"&&domain.verificationStatus!=="verified"?<small>{tr("Préparation en cours par ELTARA", "ELTARA setup in progress")}</small>:null}</article>)}</section>
    <form className="domain-form" onSubmit={submit}><div><p className="eyebrow">{tr("Domaine personnalisé", "Custom domain")}</p><h2>{tr("Ajouter votre domaine", "Add your domain")}</h2><p>{plan.customDomain?tr("Votre offre permet cette fonctionnalité.", "Your plan includes this feature."):tr("Disponible avec Essentiel et Growth.", "Available with Essential and Growth.")}</p></div><div className="domain-controls"><input value={hostname} onChange={e=>setHostname(e.target.value)} placeholder="exemple.fr" disabled={!plan.customDomain||busy}/><button className="button primary" disabled={!plan.customDomain||busy||!hostname.trim()}>{busy?tr("Enregistrement…", "Saving…"):tr("Ajouter", "Add")}</button></div></form>
    {message?<p className="account-note" role="status">{message}</p>:null}
    <p className="account-note">{tr("Le sous-domaine ELTARA est administré par la plateforme. Pour un domaine personnel, ELTARA ne le marque jamais comme vérifié au simple enregistrement : le rattachement Vercel et la vérification DNS doivent réussir avant activation.", "The ELTARA subdomain is managed by the platform. For a personal domain, ELTARA never marks it as verified just because it was registered: the Vercel connection and DNS verification must succeed before activation.")}</p>
  </AccountShell>;
}