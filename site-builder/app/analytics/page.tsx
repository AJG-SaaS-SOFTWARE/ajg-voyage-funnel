"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AccountShell } from "../../components/AccountShell";
import { BetaExperienceSwitch } from "../../components/BetaExperienceSwitch";
import { useProductLocale } from "../../lib/product-i18n";
import { getMySites, type RemoteSite } from "../../lib/supabase-site-repository";
import { getMyBetaAccess, getMySiteEntitlements } from "../../lib/subscription";
import { readBetaExperienceMode, writeBetaExperienceMode, type BetaExperienceMode } from "../../lib/beta-experience-mode";
import { getMySiteAnalytics, summarizeSiteAnalytics, type SiteAnalyticsRow } from "../../lib/site-analytics";
import { trackProductEvent } from "../../lib/product-analytics";

type LoadState = "loading" | "ready" | "error";

const sourceLabel = (source: string, tr: (fr: string, en: string) => string) => ({
  direct: tr("Direct", "Direct"),
  internal: tr("Interne", "Internal"),
  search: tr("Recherche", "Search"),
  social: tr("Réseaux sociaux", "Social"),
  referral: tr("Sites référents", "Referrals"),
  other: tr("Autre", "Other")
}[source] || source);

const ctaLabel = (label: string, tr: (fr: string, en: string) => string) => ({
  booking: tr("Réservation", "Booking"),
  social_instagram: "Instagram",
  social_facebook: "Facebook",
  contact_email: tr("E-mail", "Email")
}[label] || label.replaceAll("_", " "));

export default function AnalyticsPage() {
  const { tr } = useProductLocale();
  const [sites, setSites] = useState<RemoteSite[]>([]);
  const [siteId, setSiteId] = useState("");
  const [rows, setRows] = useState<SiteAnalyticsRow[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [notice, setNotice] = useState("");
  const [growthExperience, setGrowthExperience] = useState(false);
  const [betaActive, setBetaActive] = useState(false);
  const [betaMode, setBetaMode] = useState<BetaExperienceMode>("essential");

  async function load(selectedId?: string, forcedMode?: BetaExperienceMode) {
    setState("loading");
    setNotice("");
    try {
      const owned = await getMySites();
      setSites(owned);
      const selected = owned.find((site) => site.id === (selectedId || siteId)) || owned[0];
      if (!selected) {
        setSiteId("");
        setRows([]);
        setState("ready");
        return;
      }
      setSiteId(selected.id);

      const [analyticsRows, entitlements, beta] = await Promise.all([
        getMySiteAnalytics(selected.id, 30),
        getMySiteEntitlements(selected.id),
        getMyBetaAccess().catch(() => ({ active: false, startsAt: null, expiresAt: null }))
      ]);

      const resolvedMode = beta.active ? (forcedMode || readBetaExperienceMode()) : "growth";
      const paidGrowth = entitlements.planKey === "growth" && ["active", "trialing"].includes(entitlements.status);
      setRows(analyticsRows);
      setBetaActive(beta.active);
      if (beta.active) setBetaMode(resolvedMode);
      setGrowthExperience(beta.active ? resolvedMode === "growth" : paidGrowth);
      setState("ready");
    } catch (error) {
      setState("error");
      setNotice(error instanceof Error ? error.message : tr("Analytics momentanément indisponibles.", "Analytics are temporarily unavailable."));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const summary = useMemo(() => summarizeSiteAnalytics(rows), [rows]);
  const selectedSite = sites.find((site) => site.id === siteId) || null;

  function changeBetaMode(mode: BetaExperienceMode) {
    writeBetaExperienceMode(mode);
    setBetaMode(mode);
    setGrowthExperience(mode === "growth");
    void trackProductEvent(mode === "growth" ? "beta_growth_selected" : "beta_essential_selected", siteId || null);
    void load(siteId || undefined, mode);
  }

  return (
    <AccountShell
      active="analytics"
      eyebrow={tr("Performance", "Performance")}
      title={tr("Analytics", "Analytics")}
      description={tr(
        "Comprenez ce qui se passe sur votre site sans ajouter de cookie marketing : visites, actions et contacts sont agrégés directement par ELTARA.",
        "Understand what happens on your website without adding marketing cookies: visits, actions and contacts are aggregated directly by ELTARA."
      )}
    >
      {betaActive ? <BetaExperienceSwitch compact mode={betaMode} onChange={changeBetaMode} /> : null}

      <section className="panel analytics-toolbar">
        <label>
          {tr("Site analysé", "Website")}
          <select value={siteId} onChange={(event) => void load(event.target.value)} disabled={!sites.length || state === "loading"}>
            {sites.length ? sites.map((site) => (
              <option key={site.id} value={site.id}>{site.config.brandName || site.slug}</option>
            )) : <option value="">{tr("Aucun site", "No website")}</option>}
          </select>
        </label>
        <div>
          <b>{tr("30 derniers jours", "Last 30 days")}</b>
          <small>{tr("Données agrégées · aucun contenu de formulaire", "Aggregated data · no form content")}</small>
        </div>
      </section>

      {state === "loading" ? <p className="account-note">{tr("Chargement des analytics…", "Loading analytics…")}</p> : null}
      {state === "error" ? <p className="account-note">{notice}</p> : null}

      {state === "ready" && !selectedSite ? (
        <section className="panel analytics-empty">
          <h2>{tr("Publiez votre premier site", "Publish your first website")}</h2>
          <p>{tr("Les analytics commenceront automatiquement dès qu’un site ELTARA recevra des visites.", "Analytics will start automatically as soon as an ELTARA website receives visits.")}</p>
          <Link className="button primary" href="/builder">{tr("Créer mon site", "Create my website")}</Link>
        </section>
      ) : null}

      {state === "ready" && selectedSite ? (
        <>
          <section className="analytics-metrics" aria-label={tr("Indicateurs principaux", "Key metrics")}>
            <article><small>{tr("Visites", "Views")}</small><strong>{summary.views}</strong><span>{tr("pages vues", "page views")}</span></article>
            <article><small>{tr("Actions", "Actions")}</small><strong>{summary.ctaClicks}</strong><span>{tr("clics sur vos CTA", "CTA clicks")}</span></article>
            <article><small>{tr("Contacts", "Contacts")}</small><strong>{summary.formSubmits}</strong><span>{tr("formulaires envoyés", "forms submitted")}</span></article>
            <article><small>{tr("Taux d’action", "Action rate")}</small><strong>{summary.actionRate.toFixed(1)}%</strong><span>{tr("actions / visites", "actions / views")}</span></article>
          </section>

          {summary.views === 0 ? (
            <section className="panel analytics-empty">
              <h2>{tr("Les premières données vont arriver ici", "Your first data will appear here")}</h2>
              <p>{tr(
                "Le suivi est actif sur les pages publiées. Partagez votre site puis revenez ici : aucune configuration supplémentaire n’est nécessaire.",
                "Tracking is active on published pages. Share your website and come back here: no additional setup is required."
              )}</p>
              <Link className="button secondary" href="/builder?step=review">{tr("Voir mon lien public", "View my public link")}</Link>
            </section>
          ) : (
            <section className="analytics-detail-grid">
              <article className="panel analytics-card">
                <div className="analytics-card-head">
                  <div><p className="eyebrow">{tr("Contenu", "Content")}</p><h2>{tr("Pages les plus vues", "Most viewed pages")}</h2></div>
                  <small>{tr("Vues", "Views")}</small>
                </div>
                <div className="analytics-ranking">
                  {summary.topPages.map((page) => (
                    <div key={page.pagePath}>
                      <span>{page.pagePath === "/" ? tr("Accueil", "Home") : page.pagePath.replace("/p/", "")}</span>
                      <b>{page.views}</b>
                    </div>
                  ))}
                </div>
              </article>

              <article className="panel analytics-card">
                <div className="analytics-card-head">
                  <div><p className="eyebrow">{tr("Acquisition", "Acquisition")}</p><h2>{tr("Origine des visites", "Traffic sources")}</h2></div>
                  <small>{tr("Vues", "Views")}</small>
                </div>
                <div className="analytics-ranking">
                  {summary.sources.map((source) => (
                    <div key={source.source}>
                      <span>{sourceLabel(source.source, tr)}</span>
                      <b>{source.views}</b>
                    </div>
                  ))}
                </div>
              </article>

              <article className="panel analytics-card">
                <div className="analytics-card-head">
                  <div><p className="eyebrow">{tr("Conversion", "Conversion")}</p><h2>{tr("Actions déclenchées", "Triggered actions")}</h2></div>
                  <small>{tr("Clics", "Clicks")}</small>
                </div>
                <div className="analytics-ranking">
                  {summary.ctas.length ? summary.ctas.map((cta) => (
                    <div key={cta.label}>
                      <span>{ctaLabel(cta.label, tr)}</span>
                      <b>{cta.clicks}</b>
                    </div>
                  )) : <p className="analytics-muted">{tr("Aucun clic CTA enregistré pour le moment.", "No CTA click recorded yet.")}</p>}
                </div>
                {summary.formStarts > 0 ? (
                  <p className="analytics-form-rate">
                    {tr("Formulaire complété :", "Form completion:")} <b>{summary.contactCompletionRate?.toFixed(1)}%</b>
                    <span>{summary.formSubmits}/{summary.formStarts}</span>
                  </p>
                ) : null}
              </article>
            </section>
          )}

          {growthExperience ? (
            <section className="panel analytics-growth">
              <div className="analytics-growth-intro">
                <div>
                  <p className="eyebrow">Growth</p>
                  <h2>{tr("Opportunités détectées", "Detected opportunities")}</h2>
                  <p>{tr(
                    "ELTARA ne recommande une action que lorsque le volume observé est suffisant. Les règles restent déterministes à ce stade.",
                    "ELTARA recommends an action only when the observed volume is sufficient. Rules remain deterministic at this stage."
                  )}</p>
                </div>
                <Link className="button secondary" href="/growth">{tr("Ouvrir le pilotage Growth", "Open Growth management")}</Link>
              </div>

              {summary.opportunities.length ? (
                <div className="analytics-opportunities">
                  {summary.opportunities.map((item) => (
                    <article key={item.key + (item.pagePath || "")} className={"analytics-opportunity " + item.priority}>
                      <span>{item.priority === "high" ? tr("Priorité haute", "High priority") : tr("À surveiller", "Watch")}</span>
                      {item.key === "cta" ? (
                        <>
                          <h3>{tr("Une page attire des visites sans déclencher d’action", "A page gets traffic without generating action")}</h3>
                          <p>{tr(
                            `${item.pagePath === "/" ? "L’accueil" : item.pagePath} a reçu ${item.value} vues sans clic CTA ni contact. Vérifiez la promesse et la visibilité de l’action principale.`,
                            `${item.pagePath === "/" ? "Home" : item.pagePath} received ${item.value} views without a CTA click or contact. Review the promise and visibility of the primary action.`
                          )}</p>
                        </>
                      ) : item.key === "form" ? (
                        <>
                          <h3>{tr("Le formulaire perd une partie des visiteurs", "The form loses some visitors")}</h3>
                          <p>{tr(
                            `Seulement ${item.value.toFixed(1)}% des formulaires commencés sont envoyés. Simplifiez le parcours ou clarifiez ce qui se passe après l’envoi.`,
                            `Only ${item.value.toFixed(1)}% of started forms are submitted. Simplify the journey or clarify what happens after submission.`
                          )}</p>
                        </>
                      ) : (
                        <>
                          <h3>{tr("Le trafic dépend fortement d’une seule source", "Traffic relies heavily on one source")}</h3>
                          <p>{tr(
                            `${item.value.toFixed(1)}% des visites viennent de la même catégorie de source. Growth peut vous aider à diversifier les points d’entrée.`,
                            `${item.value.toFixed(1)}% of visits come from the same source category. Growth can help diversify entry points.`
                          )}</p>
                        </>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="analytics-growth-empty">
                  <b>{tr("Pas d’opportunité fiable à signaler pour le moment", "No reliable opportunity to report yet")}</b>
                  <p>{tr(
                    "Soit les signaux sont sains, soit le volume est encore trop faible. ELTARA attend davantage de données plutôt que de produire une recommandation fragile.",
                    "Either signals look healthy or volume is still too low. ELTARA waits for more data rather than producing a weak recommendation."
                  )}</p>
                </div>
              )}
            </section>
          ) : (
            <section className="analytics-growth-discovery">
              <div>
                <span>Growth</span>
                <b>{tr("Transformer les chiffres en actions", "Turn numbers into actions")}</b>
                <p>{tr(
                  "Votre interface Essentiel reste centrée sur les mesures utiles. Growth ajoute l’analyse des opportunités seulement quand vous souhaitez aller plus loin.",
                  "Your Essential interface stays focused on useful metrics. Growth adds opportunity analysis only when you want to go further."
                )}</p>
              </div>
              <Link className="button secondary" href="/plans">{tr("Découvrir Growth", "Discover Growth")}</Link>
            </section>
          )}
        </>
      ) : null}
    </AccountShell>
  );
}
