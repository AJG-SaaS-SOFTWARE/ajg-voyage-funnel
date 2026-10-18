"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { AccountShell } from "../../components/AccountShell";
import { getMyDomains, getMySite, getMySites, removeCustomDomain, requestCustomDomain, syncSiteDomain, type SiteDomain } from "../../lib/supabase-site-repository";
import { freeEntitlements, getMySiteEntitlements, type SubscriptionEntitlements } from "../../lib/subscription";
import { useProductLocale } from "../../lib/product-i18n";
import { domainGuide } from "../../lib/domain-guidance";
import { CustomerErrorHelp } from "../../components/CustomerErrorHelp";
import { runDomainAction } from "../../lib/domain-action-result";

export default function DomainsPage() {
  const { locale, tr } = useProductLocale();
  const [domains,setDomains]=useState<SiteDomain[]>([]);
  const [plan,setPlan]=useState<SubscriptionEntitlements>(freeEntitlements);
  const [hostname,setHostname]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [refreshRequired, setRefreshRequired] = useState(false);
  const [showErrorHelp, setShowErrorHelp] = useState(false);
  const actionLock = useRef(false);
  const [sites,setSites]=useState<Array<{id:string;slug:string}>>([]);
  const [siteId,setSiteId]=useState("");
  const refresh = async (selectedId?: string) => {
    const owned = await getMySites();
    const target = selectedId || siteId;
    const chosen = target ? owned.find(site => site.id === target) : owned[0];
    if (target && !chosen) throw new Error("domain_site_readback_unconfirmed");
    const [items, entitlements] = await Promise.all([
      chosen ? getMyDomains(chosen.id) : Promise.resolve([]),
      chosen ? getMySiteEntitlements(chosen.id) : Promise.resolve(freeEntitlements)
    ]);
    // Commit the whole selected-site view only after both reads succeed.
    setSites(owned.map(site => ({ id: site.id, slug: site.slug })));
    setSiteId(chosen?.id || "");
    setDomains(items);
    setPlan(entitlements);
  };
  useEffect(() => {
    actionLock.current = true;
    setBusy(true);
    void refresh().catch(() => {
      setRefreshRequired(true);
      setShowErrorHelp(true);
      setMessage(tr("Impossible de charger les domaines. Actualisez la page ; si le problème persiste, ouvrez le Health Center.", "Unable to load domains. Refresh the page; if the issue persists, open the Health Center."));
    }).finally(() => {
      actionLock.current = false;
      setBusy(false);
    });
  }, []);

  // A read retry is separate from an action retry: it never resubmits a domain.
  const reload = async (selectedId = siteId) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    try {
      await refresh(selectedId);
      setRefreshRequired(false);
      setShowErrorHelp(false);
      setMessage(tr("Liste des domaines actualisée. Vérifiez son état avant toute nouvelle action.", "Domain list refreshed. Review its status before taking another action."));
    } catch {
      setRefreshRequired(true);
      setShowErrorHelp(false);
      setMessage(tr("La liste des domaines reste indisponible. Aucune action n’a été relancée. Ouvrez le Health Center si le problème persiste.", "The domain list is still unavailable. No action was resubmitted. Open the Health Center if the issue persists."));
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  };

  const act = async <T,>(mutate: () => Promise<T>, success: (value: T) => string) => {
    if (actionLock.current || refreshRequired) return;
    actionLock.current = true;
    setBusy(true);
    setMessage("");
    setShowErrorHelp(false);
    try {
      const result = await runDomainAction({ mutate, refresh: () => refresh(siteId) });
      if (result.stage === "confirmed") {
        setMessage(success(result.value));
      } else {
        setRefreshRequired(true);
        setMessage(result.stage === "refresh_failed"
          ? tr("L’action a été confirmée, mais la liste n’a pas pu être actualisée. Relisez son état avec le bouton ci-dessous, sans relancer l’action.", "The action was confirmed, but the list could not be refreshed. Use the button below to read its status without resubmitting the action.")
          : tr("Le résultat de l’action n’est pas confirmé. Elle a peut-être été appliquée. Actualisez uniquement la liste avant toute nouvelle tentative.", "The action result is unconfirmed. It may have been applied. Refresh only the list before attempting another action."));
      }
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await act(async () => {
      const site = await getMySite(siteId);
      if (!site) throw new Error("website_missing");
      const domain = await requestCustomDomain(hostname, site.id);
      setHostname("");
      return syncSiteDomain(site.id, domain.id);
    }, result => result.verified
      ? tr("Domaine rattaché et vérifié.", "Domain connected and verified.")
      : tr("Domaine rattaché à Vercel. Configurez les enregistrements DNS demandés puis relancez la vérification.", "Domain connected to Vercel. Configure the requested DNS records, then run verification again."));
  };
  const verify = async (domain: SiteDomain) => {
    await act(() => syncSiteDomain(siteId, domain.id), result => {
      if (result.verified) return tr("Domaine vérifié, DNS opérationnel et activé.", "Domain verified, DNS operational and activated.");
      const instructions = result.verification.map(item => [item.type, item.domain, item.value].filter(Boolean).join(" · ")).filter(Boolean);
      return instructions.length
        ? `${tr("DNS à configurer :", "DNS to configure:")} ${instructions.join(" | ")}. ${tr("Ajoutez uniquement l’enregistrement recommandé ci-dessus, puis relancez la vérification après propagation.", "Add only the recommended record above, then run verification again after DNS propagation.")}`
        : tr("Vérification encore en attente. Contrôlez la configuration DNS puis réessayez.", "Verification is still pending. Check the DNS configuration and try again.");
    });
  };
  const remove = async (id: string) => {
    await act(() => removeCustomDomain(id), () => tr("Domaine retiré de la liste.", "Domain removed from the list."));
  };

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
    {sites.length>1?<section className="panel"><label>{tr("Site", "Website")}<select value={siteId} disabled={busy || refreshRequired} onChange={event => void reload(event.target.value)}>{sites.map(site=><option key={site.id} value={site.id}>{site.slug}</option>)}</select></label></section>:null}
    <section className="domain-list">{domains.map(domain=><article className="domain-row" key={domain.id}><div><b>{domain.hostname}</b><p>{domain.kind==="managed_subdomain"?tr("Sous-domaine ELTARA", "ELTARA subdomain"):tr("Domaine personnalisé", "Custom domain")} · {domain.verificationStatus==="verified"?tr("Vérifié", "Verified"):domain.verificationStatus==="failed"?tr("Échec de vérification", "Verification failed"):tr("En attente de vérification", "Verification pending")}</p></div>{domain.kind==="custom_domain"&&domain.verificationStatus!=="verified"?<div><button className="text-button" disabled={busy || refreshRequired} onClick={()=>void verify(domain)}>{tr("Vérifier", "Verify")}</button><button className="text-button" disabled={busy || refreshRequired} onClick={()=>void remove(domain.id)}>{tr("Retirer", "Remove")}</button></div>:domain.kind==="managed_subdomain"&&domain.verificationStatus!=="verified"?<small>{tr("Préparation en cours par ELTARA", "ELTARA setup in progress")}</small>:null}</article>)}</section>
    <form className="domain-form" onSubmit={submit}><div><p className="eyebrow">{tr("Domaine personnalisé", "Custom domain")}</p><h2>{tr("Ajouter votre domaine", "Add your domain")}</h2><p>{plan.customDomain?tr("Votre offre permet cette fonctionnalité.", "Your plan includes this feature."):tr("Disponible avec Essentiel et Growth.", "Available with Essential and Growth.")}</p></div><div className="domain-controls"><input value={hostname} onChange={e=>setHostname(e.target.value)} placeholder={tr("exemple.fr", "example.com")} disabled={!plan.customDomain||busy||refreshRequired}/><button className="button primary" disabled={!plan.customDomain||busy||refreshRequired||!hostname.trim()}>{busy?tr("Enregistrement…", "Saving…"):tr("Ajouter", "Add")}</button></div></form>
    {message?<p className="account-note" role="status">{message}</p>:null}
    <CustomerErrorHelp message={showErrorHelp ? message : null} />
    {refreshRequired ? <section className="panel" aria-label={tr("Relire l’état des domaines", "Read domain status again")}>
      <button type="button" className="button secondary" disabled={busy} onClick={() => void reload()}>{tr("Actualiser la liste sans relancer l’action", "Refresh the list without resubmitting the action")}</button>
      <p><a className="text-link" href="/support">{tr("Ouvrir le Health Center", "Open the Health Center")}</a></p>
    </section> : null}
    <p className="account-note">{tr("Le sous-domaine ELTARA est administré par la plateforme. Pour un domaine personnel, ELTARA ne le marque jamais comme vérifié au simple enregistrement : le rattachement Vercel et la vérification DNS doivent réussir avant activation.", "The ELTARA subdomain is managed by the platform. For a personal domain, ELTARA never marks it as verified just because it was registered: the Vercel connection and DNS verification must succeed before activation.")}</p>
  </AccountShell>;
}
