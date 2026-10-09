"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AccountShell } from "../../components/AccountShell";
import { BetaExperienceSwitch } from "../../components/BetaExperienceSwitch";
import { useProductLocale } from "../../lib/product-i18n";
import { formatProductNumber } from "../../lib/product-format";
import { getMySites, type RemoteSite } from "../../lib/supabase-site-repository";
import { getMyBetaAccess, getMySiteEntitlements } from "../../lib/subscription";
import { readBetaExperienceMode, writeBetaExperienceMode, type BetaExperienceMode } from "../../lib/beta-experience-mode";
import {
  compareSiteAnalytics,
  getMySiteAnalytics,
  type AnalyticsPeriodDays,
  type SiteAnalyticsRow
} from "../../lib/site-analytics";
import { trackProductEvent } from "../../lib/product-analytics";

type LoadState = "loading" | "ready" | "error";

const sourceLabel = (source: string, tr: (fr: string, en: string) => string) => {
  const labels: Record<string, string> = {
    direct: tr("Direct", "Direct"),
    internal: tr("Interne", "Internal"),
    search: tr("Recherche", "Search"),
    social: tr("Réseaux sociaux", "Social"),
    referral: tr("Sites référents", "Referrals"),
    other: tr("Autre", "Other")
  };
  return labels[source] || source;
};

const ctaLabel = (label: string, tr: (fr: string, en: string) => string) => {
  const labels: Record<string, string> = {
    booking: tr("Réservation", "Booking"),
    social_instagram: "Instagram",
    social_facebook: "Facebook",
    contact_email: tr("E-mail", "Email")
  };
  return labels[label] || label.replaceAll("_", " ");
};

function DeltaBadge({
  value,
  unit = "%",
  tr,
  locale
}: {
  value: number | null;
  unit?: "%" | "pt";
  tr: (fr: string, en: string) => string;
  locale: "fr" | "en";
}) {
  if (value === null) {
    return <span className="analytics-delta neutral">{tr("Nouveau", "New")}</span>;
  }
  const positive = value > 0;
  const negative = value < 0;
  return (
    <span className={"analytics-delta " + (positive ? "up" : negative ? "down" : "neutral")}>
      {positive ? "+" : ""}{formatProductNumber(value, locale, 1, 1)}{unit === "%" ? "%" : " pt"}
    </span>
  );
}

function pageLabel(path: string, tr: (fr: string, en: string) => string) {
  if (path === "/") return tr("Accueil", "Home");
  return path.replace("/p/", "").replaceAll("-", " ");
}

export default function AnalyticsPage() {
  const { locale, tr } = useProductLocale();
  const [sites, setSites] = useState<RemoteSite[]>([]);
  const [siteId, setSiteId] = useState("");
  const [rows, setRows] = useState<SiteAnalyticsRow[]>([]);
  const [period, setPeriod] = useState<AnalyticsPeriodDays>(30);
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
        getMySiteAnalytics(selected.id, 180),
        getMySiteEntitlements(selected.id),
        getMyBetaAccess().catch(() => ({ active: false, startsAt: null, expiresAt: null }))
      ]);

      const resolvedMode = beta.active ? (forcedMode || readBetaExperienceMode()) : "growth";
      const paidGrowth = entitlements.planKey === "growth" && ["active", "trialing"].includes(entitlements.status);
      setRows(analyticsRows);
      setBetaActive(beta.active);
      if (beta.active) setBetaMode(resolvedMode);
      setGrowthExperience(beta.active ? resolvedMode !== "essential" : paidGrowth);
      if (beta.active && resolvedMode === "growth") {
        void trackProductEvent("beta_analytics_opened", selected.id);
      }
      setState("ready");
    } catch (error) {
      setState("error");
      setNotice(error instanceof Error ? error.message : tr("Analytics momentanément indisponibles.", "Analytics are temporarily unavailable."));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const comparison = useMemo(() => compareSiteAnalytics(rows, period), [rows, period]);
  const summary = comparison.current;
  const selectedSite = sites.find((site) => site.id === siteId) || null;

  function changeBetaMode(mode: BetaExperienceMode) {
    writeBetaExperienceMode(mode);
    setBetaMode(mode);
    setGrowthExperience(mode !== "essential");
    void trackProductEvent(mode === "growth" ? "beta_growth_selected" : mode === "architect" ? "beta_architect_selected" : "beta_essential_selected", siteId || null);
    void load(siteId || undefined, mode);
  }

  function opportunityHref(key: "cta" | "form" | "acquisition") {
    if (key === "cta") return "/builder?step=story";
    if (key === "form") return "/builder?step=options";
    return "/builder?step=booking";
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

        <div className="analytics-period-wrap">
          <span>{tr("Période", "Period")}</span>
          <div className="analytics-periods" role="group" aria-label={tr("Période d’analyse", "Analytics period")}>
            {([7, 30, 90] as AnalyticsPeriodDays[]).map((days) => (
              <button
                key={days}
                type="button"
                className={period === days ? "active" : ""}
                aria-pressed={period === days}
                onClick={() => setPeriod(days)}
              >
                {days}j
              </button>
            ))}
          </div>
          <small>{tr("Comparé à la période précédente", "Compared with the previous period")}</small>
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
            <article>
              <div><small>{tr("Visites", "Views")}</small><DeltaBadge value={comparison.deltas.views} tr={tr} locale={locale} /></div>
              <strong>{summary.views}</strong>
              <span>{tr("pages vues", "page views")}</span>
            </article>
            <article>
              <div><small>{tr("Actions", "Actions")}</small><DeltaBadge value={comparison.deltas.ctaClicks} tr={tr} locale={locale} /></div>
              <strong>{summary.ctaClicks}</strong>
              <span>{tr("clics sur vos CTA", "CTA clicks")}</span>
            </article>
            <article>
              <div><small>{tr("Contacts", "Contacts")}</small><DeltaBadge value={comparison.deltas.formSubmits} tr={tr} locale={locale} /></div>
              <strong>{summary.formSubmits}</strong>
              <span>{tr("formulaires envoyés", "forms submitted")}</span>
            </article>
            <article>
              <div><small>{tr("Taux d’action", "Action rate")}</small><DeltaBadge value={comparison.deltas.actionRatePoints} unit="pt" tr={tr} locale={locale} /></div>
              <strong>{formatProductNumber(summary.actionRate, locale, 1, 1)}%</strong>
              <span>{tr("actions / visites", "actions / views")}</span>
            </article>
          </section>

          {summary.views === 0 ? (
            <section className="panel analytics-empty">
              <h2>{tr("Pas encore de visite sur cette période", "No visits during this period yet")}</h2>
              <p>{tr(
                "Le suivi reste actif sur vos pages publiées. Vous pouvez élargir la période ou partager votre site pour alimenter les prochains résultats.",
                "Tracking remains active on your published pages. Expand the period or share your website to feed future results."
              )}</p>
              <Link className="button secondary" href="/builder?step=review">{tr("Voir mon lien public", "View my public link")}</Link>
            </section>
          ) : (
            <>
              <section className="analytics-detail-grid">
                <article className="panel analytics-card">
                  <div className="analytics-card-head">
                    <div><p className="eyebrow">{tr("Contenu", "Content")}</p><h2>{tr("Pages les plus vues", "Most viewed pages")}</h2></div>
                    <small>{tr("Vues", "Views")}</small>
                  </div>
                  <div className="analytics-ranking">
                    {summary.topPages.map((page) => (
                      <div key={page.pagePath}>
                        <span>{pageLabel(page.pagePath, tr)}</span>
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
                      {tr("Formulaire complété :", "Form completion:")} <b>{summary.contactCompletionRate === null ? "—" : formatProductNumber(summary.contactCompletionRate, locale, 1, 1)}%</b>
                      <span>{summary.formSubmits}/{summary.formStarts}</span>
                    </p>
                  ) : null}
                </article>
              </section>

              <section className="panel analytics-page-conversion">
                <div className="analytics-card-head">
                  <div>
                    <p className="eyebrow">{tr("Par page", "By page")}</p>
                    <h2>{tr("Conversion des pages", "Page conversion")}</h2>
                  </div>
                  <small>{tr("CTA + contacts / vues", "CTA + contacts / views")}</small>
                </div>
                <div className="analytics-conversion-table">
                  <div className="analytics-conversion-head" aria-hidden="true">
                    <span>{tr("Page", "Page")}</span>
                    <span>{tr("Vues", "Views")}</span>
                    <span>{tr("Actions", "Actions")}</span>
                    <span>{tr("Taux", "Rate")}</span>
                  </div>
                  {summary.topPages.map((page) => (
                    <div className="analytics-conversion-row" key={page.pagePath}>
                      <b>{pageLabel(page.pagePath, tr)}</b>
                      <span>{page.views}</span>
                      <span>{page.ctaClicks + page.formSubmits}</span>
                      <strong>{formatProductNumber(page.actionRate, locale, 1, 1)}%</strong>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {growthExperience ? (
            <section className="panel analytics-growth">
              <div className="analytics-growth-intro">
                <div>
                  <p className="eyebrow">Growth</p>
                  <h2>{tr("Opportunités détectées", "Detected opportunities")}</h2>
                  <p>{tr(
                    "ELTARA ne recommande une action que lorsque le volume observé est suffisant. Chaque signal peut maintenant mener directement à la zone du site à retravailler.",
                    "ELTARA recommends an action only when the observed volume is sufficient. Each signal can now lead directly to the part of the website to improve."
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
                            `${pageLabel(item.pagePath || "/", tr)} a reçu ${item.value} vues sans clic CTA ni contact. Retravaillez la promesse et l’action principale.`,
                            `${pageLabel(item.pagePath || "/", tr)} received ${item.value} views without a CTA click or contact. Improve the promise and primary action.`
                          )}</p>
                        </>
                      ) : item.key === "form" ? (
                        <>
                          <h3>{tr("Le formulaire perd une partie des visiteurs", "The form loses some visitors")}</h3>
                          <p>{tr(
                            `Seulement ${formatProductNumber(item.value, locale, 1, 1)}% des formulaires commencés sont envoyés. Simplifiez le parcours ou clarifiez ce qui se passe après l’envoi.`,
                            `Only ${formatProductNumber(item.value, locale, 1, 1)}% of started forms are submitted. Simplify the journey or clarify what happens after submission.`
                          )}</p>
                        </>
                      ) : (
                        <>
                          <h3>{tr("Le trafic dépend fortement d’une seule source", "Traffic relies heavily on one source")}</h3>
                          <p>{tr(
                            `${formatProductNumber(item.value, locale, 1, 1)}% des visites viennent de la même catégorie de source. Diversifiez les points d’entrée et les liens diffusés.`,
                            `${formatProductNumber(item.value, locale, 1, 1)}% of visits come from the same source category. Diversify entry points and shared links.`
                          )}</p>
                        </>
                      )}
                      <Link className="analytics-opportunity-action" href={opportunityHref(item.key)}>
                        {item.key === "cta"
                          ? tr("Retravailler le message et le CTA", "Improve message and CTA")
                          : item.key === "form"
                            ? tr("Revoir le parcours de contact", "Review contact journey")
                            : tr("Développer les points d’entrée", "Expand entry points")} →
                      </Link>
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
