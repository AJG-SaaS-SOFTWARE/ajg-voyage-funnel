"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LanguageSwitch } from "../../components/LanguageSwitch";
import { BetaExperienceSwitch } from "../../components/BetaExperienceSwitch";
import { useProductLocale } from "../../lib/product-i18n";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";
import { getMySites } from "../../lib/supabase-site-repository";
import {
  evaluatePostPublishPerformance,
  getMySiteAnalytics,
  summarizeSiteAnalytics,
  type SiteAnalyticsRow
} from "../../lib/site-analytics";
import { getMyBetaAccess, getMySiteEntitlements } from "../../lib/subscription";
import { readBetaExperienceMode, writeBetaExperienceMode, type BetaExperienceMode } from "../../lib/beta-experience-mode";
import { trackProductEvent } from "../../lib/product-analytics";
import type { SupportDiagnosis } from "../../lib/support-diagnostics";
import { supportGuidanceForCheck } from "../../lib/support-guidance";
import { groupGrowthHealthChecks, growthHealthCounts, type GrowthHealthGroupKey } from "../../lib/growth-health";

type GrowthState = "loading" | "guest" | "locked" | "no_site" | "draft" | "ready" | "error";
type SiteOption = { id: string; slug: string; status: string; publishedAt: string | null };

const groupLabels: Record<GrowthHealthGroupKey, { fr: string; en: string; detailFr: string; detailEn: string }> = {
  availability: {
    fr: "Disponibilité & accès",
    en: "Availability & access",
    detailFr: "Publication, rendu public, temps de réponse et domaine.",
    detailEn: "Publishing, public rendering, response time and domain."
  },
  visibility: {
    fr: "Visibilité",
    en: "Visibility",
    detailFr: "SEO technique, sitemap et liens configurés.",
    detailEn: "Technical SEO, sitemap and configured links."
  },
  content: {
    fr: "Contenu utile",
    en: "Useful content",
    detailFr: "Formulaire, images et médias attendus par le site.",
    detailEn: "Contact form, images and media expected by the website."
  },
  operations: {
    fr: "Continuité de service",
    en: "Service continuity",
    detailFr: "Sauvegarde, stockage, accès et garde-fous IA.",
    detailEn: "Backup, storage, access and AI guardrails."
  }
};

export default function GrowthPage() {
  const { locale, tr } = useProductLocale();
  const [state, setState] = useState<GrowthState>("loading");
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [siteId, setSiteId] = useState("");
  const [diagnosis, setDiagnosis] = useState<SupportDiagnosis | null>(null);
  const [betaActive, setBetaActive] = useState(false);
  const [betaExperienceMode, setBetaExperienceMode] = useState<BetaExperienceMode>("essential");
  const [notice, setNotice] = useState("");
  const [running, setRunning] = useState(false);
  const [analyticsRows, setAnalyticsRows] = useState<SiteAnalyticsRow[]>([]);

  async function sessionToken() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  async function load(selectedId?: string, forcedMode?: BetaExperienceMode) {
    setRunning(true);
    setNotice("");
    try {
      const accessToken = await sessionToken();
      if (!accessToken) {
        setState("guest");
        return;
      }

      const owned = await getMySites();
      const options = owned.map((site) => ({ id: site.id, slug: site.slug, status: site.status, publishedAt: site.publishedAt }));
      setSites(options);
      if (!options.length) {
        setSiteId("");
        setDiagnosis(null);
        setAnalyticsRows([]);
        setState("no_site");
        return;
      }

      const selected = options.find((site) => site.id === (selectedId || siteId)) || options[0];
      setSiteId(selected.id);

      const [entitlements, beta] = await Promise.all([
        getMySiteEntitlements(selected.id),
        getMyBetaAccess().catch(() => ({ active: false, startsAt: null, expiresAt: null }))
      ]);
      const resolvedMode = beta.active ? (forcedMode || readBetaExperienceMode()) : "growth";
      setBetaActive(beta.active);
      if (beta.active) setBetaExperienceMode(resolvedMode);

      const paidGrowth =
        entitlements.planKey === "growth" &&
        ["active", "trialing"].includes(entitlements.status);
      const growthExperienceEnabled = beta.active ? resolvedMode === "growth" : paidGrowth;

      if (!growthExperienceEnabled) {
        setDiagnosis(null);
        setAnalyticsRows([]);
        setState("locked");
        return;
      }

      if (selected.status !== "published") {
        setDiagnosis(null);
        setAnalyticsRows([]);
        setState("draft");
        return;
      }

      const analyticsPromise = getMySiteAnalytics(selected.id, 180).catch(() => [] as SiteAnalyticsRow[]);
      const response = await fetch("/api/support/health?siteId=" + encodeURIComponent(selected.id), {
        headers: { Authorization: "Bearer " + accessToken },
        cache: "no-store"
      });
      const body = await response.json().catch(() => null);
      if (response.status === 401) {
        setState("guest");
        return;
      }
      if (!response.ok || !body?.health?.diagnosis) {
        throw new Error(body?.error || tr("Pilotage Growth indisponible.", "Growth cockpit is unavailable."));
      }
      setDiagnosis(body.health.diagnosis);
      setAnalyticsRows(await analyticsPromise);
      setState("ready");
    } catch (error) {
      setState("error");
      setNotice(error instanceof Error ? error.message : tr("Pilotage Growth indisponible.", "Growth cockpit is unavailable."));
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const changeBetaExperienceMode = (mode: BetaExperienceMode) => {
    writeBetaExperienceMode(mode);
    setBetaExperienceMode(mode);
    if (betaActive) {
      void trackProductEvent(
        mode === "growth" ? "beta_growth_selected" : "beta_essential_selected",
        siteId || null
      );
    }
    if (mode === "growth") {
      void load(siteId || undefined, mode);
    } else {
      setDiagnosis(null);
      setState("locked");
    }
  };

  const groups = useMemo(
    () => diagnosis ? groupGrowthHealthChecks(diagnosis.checks) : [],
    [diagnosis]
  );
  const counts = useMemo(
    () => diagnosis ? growthHealthCounts(diagnosis.checks) : { healthy: 0, action: 0, incident: 0 },
    [diagnosis]
  );
  const selectedSite = sites.find((site) => site.id === siteId) || null;
  const performanceSummary = useMemo(
    () => summarizeSiteAnalytics(analyticsRows),
    [analyticsRows]
  );
  const postPublishPerformance = useMemo(
    () => evaluatePostPublishPerformance(analyticsRows, selectedSite?.publishedAt || null),
    [analyticsRows, selectedSite?.publishedAt]
  );
  const guidanceByKey = useMemo(
    () => new Map(
      (diagnosis?.checks || [])
        .map((check) => supportGuidanceForCheck(check, locale))
        .filter((item) => Boolean(item))
        .map((item) => [item!.key, item!] as const)
    ),
    [diagnosis, locale]
  );

  return (
    <main className="plans-page growth-cockpit-page">
      <section className="plans-hero growth-cockpit-hero">
        <div className="builder-language-row">
          <div>
            <p className="eyebrow">ELTARA · Growth</p>
            <span className="growth-level-badge">{tr("AI Website Manager · Niveau 1", "AI Website Manager · Level 1")}</span>
          </div>
          <LanguageSwitch compact />
        </div>
        <h1>{tr("Piloter la santé de votre site", "Manage your website health")}</h1>
        <p>{tr(
          "ELTARA rassemble les contrôles techniques déjà disponibles, détecte les écarts et vous indique où agir. Cette première vue Growth est déterministe : elle n’utilise pas de modèle IA Premium pour scanner votre site.",
          "ELTARA brings together existing technical checks, detects issues and shows where to act. This first Growth view is deterministic: it does not use a Premium AI model to scan your website."
        )}</p>
        <div className="actions">
          <Link className="button primary" href="/builder">{tr("Modifier le site", "Edit website")}</Link>
          <Link className="button secondary" href="/support">{tr("Health Center", "Health Center")}</Link>
          <Link className="button secondary" href="/">{tr("Tableau de bord", "Dashboard")}</Link>
        </div>
      </section>

      {betaActive ? (
        <BetaExperienceSwitch
          compact
          mode={betaExperienceMode}
          onChange={changeBetaExperienceMode}
        />
      ) : null}

      {sites.length > 1 ? (
        <section className="panel growth-site-selector">
          <label>
            {tr("Site piloté", "Managed website")}
            <select
              value={siteId}
              disabled={running}
              onChange={(event) => void load(event.target.value)}
            >
              {sites.map((site) => <option key={site.id} value={site.id}>{site.slug}</option>)}
            </select>
          </label>
        </section>
      ) : null}

      {state === "loading" ? (
        <section className="panel"><p>{tr("Préparation du cockpit Growth…", "Preparing the Growth cockpit…")}</p></section>
      ) : null}

      {state === "guest" ? (
        <section className="panel">
          <h2>{tr("Connexion requise", "Sign-in required")}</h2>
          <p>{tr("Connectez-vous pour accéder au pilotage Growth.", "Sign in to access Growth management.")}</p>
          <Link className="button primary" href="/login">{tr("Se connecter", "Sign in")}</Link>
        </section>
      ) : null}

      {state === "no_site" ? (
        <section className="panel">
          <h2>{tr("Créez d’abord votre site", "Create your website first")}</h2>
          <p>{tr("Le pilotage Growth commence à partir d’un site réel.", "Growth management starts from a real website.")}</p>
          <Link className="button primary" href="/builder">{tr("Créer mon site", "Create my website")}</Link>
        </section>
      ) : null}

      {state === "locked" ? (
        <section className="panel growth-locked-panel">
          <p className="eyebrow">Growth</p>
          <h2>{betaActive
            ? tr("Vous testez actuellement Essentiel", "You are currently testing Essential")
            : tr("Le pilotage continu appartient à Growth", "Continuous management is a Growth feature")}</h2>
          <p>{betaActive
            ? tr(
                "Vos droits bêta restent complets. Passez simplement en mode Growth pour tester ce cockpit, puis revenez en Essentiel quand vous le souhaitez.",
                "Your beta rights remain complete. Simply switch to Growth mode to test this cockpit, then return to Essential whenever you want."
              )
            : tr(
                "Essentiel maintient votre site en ligne et vous laisse le modifier. Growth ajoute la surveillance structurée, les recommandations et les évolutions globales.",
                "Essential keeps your website online and editable. Growth adds structured monitoring, recommendations and full-site evolution."
              )}</p>
          {betaActive ? (
            <button className="button primary" type="button" onClick={() => changeBetaExperienceMode("growth")}>
              {tr("Tester Growth maintenant", "Test Growth now")}
            </button>
          ) : (
            <Link className="button primary" href="/plans">{tr("Découvrir Growth", "Discover Growth")}</Link>
          )}
        </section>
      ) : null}

      {state === "draft" ? (
        <section className="panel growth-locked-panel">
          <p className="eyebrow">{tr("Avant le pilotage", "Before management")}</p>
          <h2>{tr("Publiez une première version", "Publish a first version")}</h2>
          <p>{tr(
            "Growth mesure et améliore un site réellement en ligne. Terminez le Quality Check et publiez d’abord votre première version.",
            "Growth measures and improves a website that is actually live. Complete the Quality Check and publish your first version first."
          )}</p>
          <Link className="button primary" href="/builder?step=review">{tr("Ouvrir la publication", "Open publishing")}</Link>
        </section>
      ) : null}

      {state === "error" ? (
        <section className="panel">
          <h2>{tr("Diagnostic momentanément indisponible", "Diagnosis temporarily unavailable")}</h2>
          <p>{notice || tr("Réessayez dans quelques instants.", "Try again in a moment.")}</p>
          <button className="button secondary" type="button" disabled={running} onClick={() => void load(siteId || undefined)}>
            {running ? tr("Actualisation…", "Refreshing…") : tr("Réessayer", "Try again")}
          </button>
        </section>
      ) : null}

      {state === "ready" && diagnosis ? (
        <>
          <section className="growth-health-summary" aria-label={tr("Résumé de santé", "Health summary")}>
            <article>
              <span className="growth-health-dot healthy" />
              <small>{tr("Contrôles sains", "Healthy checks")}</small>
              <strong>{counts.healthy}</strong>
            </article>
            <article>
              <span className="growth-health-dot action" />
              <small>{tr("Actions recommandées", "Recommended actions")}</small>
              <strong>{counts.action}</strong>
            </article>
            <article>
              <span className="growth-health-dot incident" />
              <small>{tr("Incidents", "Incidents")}</small>
              <strong>{counts.incident}</strong>
            </article>
            <article className="growth-health-overall">
              <small>{tr("État global", "Overall status")}</small>
              <strong>{diagnosis.overall === "healthy"
                ? tr("Sain", "Healthy")
                : diagnosis.overall === "action"
                  ? tr("À améliorer", "Needs action")
                  : tr("Incident", "Incident")}</strong>
              <button type="button" className="text-button" disabled={running} onClick={() => void load(siteId)}>
                {running ? tr("Analyse…", "Checking…") : tr("Relancer les contrôles", "Run checks again")}
              </button>
            </article>
          </section>

          <section className="growth-health-groups">
            {groups.map((group) => {
              const label = groupLabels[group.key];
              return (
                <article className={"growth-health-group is-" + group.status} key={group.key}>
                  <header>
                    <div>
                      <p className="eyebrow">{locale === "en" ? label.en : label.fr}</p>
                      <h2>{group.status === "healthy"
                        ? tr("Tout est conforme", "Everything looks good")
                        : group.status === "action"
                          ? tr("Une amélioration est possible", "An improvement is available")
                          : tr("Une anomalie nécessite une attention", "An issue needs attention")}</h2>
                      <p>{locale === "en" ? label.detailEn : label.detailFr}</p>
                    </div>
                    <span className={"growth-status-badge " + group.status}>
                      {group.status === "healthy" ? "✓" : group.status === "action" ? "○" : "×"}
                    </span>
                  </header>
                  <div className="growth-check-list">
                    {group.checks.map((check) => {
                      const item = guidanceByKey.get(check.key);
                      return (
                        <div className={"growth-check-row is-" + check.status} key={check.key}>
                          <span>{check.status === "healthy" ? "✓" : check.status === "action" ? "○" : "×"}</span>
                          <div>
                            <b>{item?.title || check.label}</b>
                            <p>{item
                              ? item.why
                              : check.status === "healthy"
                                ? tr("Contrôle validé par les diagnostics techniques ELTARA.", "Check passed by ELTARA technical diagnostics.")
                                : tr("ELTARA a détecté un écart qui mérite votre attention.", "ELTARA detected an issue that deserves your attention.")}</p>
                            {item ? <small><strong>{tr("Prochaine action :", "Next action:")}</strong> {item.action}</small> : null}
                          </div>
                          {item?.href && item.cta ? <Link className="text-link" href={item.href}>{item.cta} →</Link> : null}
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </section>


          <section className="panel growth-performance-panel">
            <div className="growth-performance-head">
              <div>
                <p className="eyebrow">{tr("Performance", "Performance")}</p>
                <h2>{tr("Opportunités classées par impact et confiance", "Opportunities ranked by impact and confidence")}</h2>
                <p>{tr(
                  "Growth classe uniquement les signaux qui dépassent un seuil minimum. Le score combine l’ampleur du problème et la quantité de données observées.",
                  "Growth ranks only signals that pass a minimum threshold. The score combines issue magnitude with the amount of observed data."
                )}</p>
              </div>
              <Link className="button secondary" href="/analytics">{tr("Voir tous les analytics", "View all analytics")}</Link>
            </div>

            {performanceSummary.opportunities.length ? (
              <div className="growth-performance-opportunities">
                {performanceSummary.opportunities.map((item, index) => (
                  <article key={item.key + (item.pagePath || "")}>
                    <div className="growth-opportunity-rank">
                      <span>#{index + 1}</span>
                      <strong>{item.score}/100</strong>
                    </div>
                    <div className="growth-opportunity-copy">
                      <div className="growth-opportunity-badges">
                        <span className={"impact " + item.impact}>
                          {tr("Impact", "Impact")} · {item.impact === "high" ? tr("fort", "high") : tr("modéré", "medium")}
                        </span>
                        <span className={"confidence " + item.confidence}>
                          {tr("Confiance", "Confidence")} · {item.confidence === "high" ? tr("forte", "high") : tr("moyenne", "medium")}
                        </span>
                      </div>
                      <h3>{item.key === "cta"
                        ? tr("Une page reçoit des visites sans générer d’action", "A page receives visits without generating action")
                        : item.key === "form"
                          ? tr("Le formulaire perd trop de visiteurs", "The form loses too many visitors")
                          : tr("Le trafic dépend trop d’une seule source", "Traffic relies too heavily on one source")}</h3>
                      <p>{item.key === "cta"
                        ? tr(
                            `${item.pagePath === "/" ? "L’accueil" : item.pagePath} totalise ${item.evidenceCount} vues sans action mesurée.`,
                            `${item.pagePath === "/" ? "Home" : item.pagePath} has ${item.evidenceCount} views without a measured action.`
                          )
                        : item.key === "form"
                          ? tr(
                              `${item.evidenceCount} démarrages de formulaire observés, pour ${item.value.toFixed(1)}% de complétion.`,
                              `${item.evidenceCount} form starts observed, with ${item.value.toFixed(1)}% completion.`
                            )
                          : tr(
                              `${item.value.toFixed(1)}% des visites viennent de la même catégorie de source sur ${item.evidenceCount} vues.`,
                              `${item.value.toFixed(1)}% of visits come from the same source category across ${item.evidenceCount} views.`
                            )}</p>
                      <Link className="text-link" href={item.key === "cta" ? "/builder?step=story" : item.key === "form" ? "/builder?step=options" : "/builder?step=booking"}>
                        {tr("Agir sur ce signal", "Act on this signal")} →
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="growth-performance-empty">
                <b>{tr("Aucun signal assez fort pour être priorisé", "No signal is strong enough to prioritize")}</b>
                <p>{tr(
                  "Growth attend un volume minimum avant de classer une opportunité, afin d’éviter les recommandations fragiles.",
                  "Growth waits for a minimum amount of data before ranking an opportunity, to avoid weak recommendations."
                )}</p>
              </div>
            )}
          </section>

          <section className="panel growth-measurement-panel">
            <div>
              <p className="eyebrow">{tr("Mesurer après publication", "Measure after publishing")}</p>
              <h2>{tr("La dernière modification a-t-elle amélioré le signal ?", "Did the latest change improve the signal?")}</h2>
              <p>{tr(
                "ELTARA compare des fenêtres de même durée avant et après la dernière publication. Cette mesure montre une évolution, pas une causalité certaine.",
                "ELTARA compares equal windows before and after the latest publication. This shows a change, not guaranteed causality."
              )}</p>
            </div>

            {postPublishPerformance.status === "measured" && postPublishPerformance.before && postPublishPerformance.after ? (
              <div className={"growth-measurement-result " + postPublishPerformance.outcome}>
                <div>
                  <small>{tr("Fenêtre comparée", "Compared window")}</small>
                  <strong>{postPublishPerformance.windowDays} {tr("jours avant / après", "days before / after")}</strong>
                </div>
                <div>
                  <small>{tr("Taux d’action avant", "Action rate before")}</small>
                  <strong>{postPublishPerformance.before.actionRate.toFixed(1)}%</strong>
                </div>
                <div>
                  <small>{tr("Taux d’action après", "Action rate after")}</small>
                  <strong>{postPublishPerformance.after.actionRate.toFixed(1)}%</strong>
                </div>
                <div>
                  <small>{tr("Évolution", "Change")}</small>
                  <strong>{postPublishPerformance.actionRatePoints > 0 ? "+" : ""}{postPublishPerformance.actionRatePoints.toFixed(1)} pt</strong>
                </div>
                <p>{postPublishPerformance.outcome === "improved"
                  ? tr("Signal positif : la performance s’est améliorée après publication.", "Positive signal: performance improved after publishing.")
                  : postPublishPerformance.outcome === "declined"
                    ? tr("Signal négatif : la performance a reculé après publication. Une nouvelle correction peut être utile.", "Negative signal: performance declined after publishing. Another correction may help.")
                    : tr("Signal stable : aucune évolution suffisamment nette n’est encore visible.", "Stable signal: no sufficiently clear change is visible yet.")}</p>
              </div>
            ) : postPublishPerformance.status === "collecting" ? (
              <div className="growth-measurement-wait">
                <b>{tr("Mesure en cours", "Measurement in progress")}</b>
                <p>{tr(
                  "ELTARA attend au moins 3 jours complets après la publication avant de comparer les performances.",
                  "ELTARA waits for at least 3 full days after publishing before comparing performance."
                )}</p>
              </div>
            ) : postPublishPerformance.status === "low_signal" ? (
              <div className="growth-measurement-wait">
                <b>{tr("Pas encore assez de trafic pour conclure", "Not enough traffic to conclude yet")}</b>
                <p>{tr(
                  "Les fenêtres avant/après existent, mais le volume observé est trop faible pour afficher un verdict fiable.",
                  "Before/after windows exist, but observed volume is too low to display a reliable verdict."
                )}</p>
              </div>
            ) : (
              <div className="growth-measurement-wait">
                <b>{tr("Première publication à mesurer", "First publication to measure")}</b>
                <p>{tr(
                  "Une fois une publication enregistrée et suffisamment de trafic collecté, Growth affichera ici l’évolution avant/après.",
                  "Once a publication is recorded and enough traffic is collected, Growth will show the before/after change here."
                )}</p>
              </div>
            )}
          </section>

          <section className="panel growth-next-level">
            <div>
              <p className="eyebrow">{tr("Boucle Growth", "Growth loop")}</p>
              <h2>{tr("Observer avant de recommander", "Observe before recommending")}</h2>
              <p>{tr(
                "Growth combine maintenant santé technique, opportunités de performance classées et mesure avant/après publication. Les prochaines briques pourront ajouter des recommandations SEO/AEO et contenu sur la même logique de preuve.",
                "Growth now combines technical health, ranked performance opportunities and before/after publishing measurement. The next layers can add SEO/AEO and content recommendations using the same evidence-based logic."
              )}</p>
            </div>
            <div className="actions">
              <Link className="button primary" href="/builder?step=story">{tr("Demander une évolution du site", "Request a website change")}</Link>
              <Link className="button secondary" href="/support">{tr("Ouvrir le Health Center", "Open Health Center")}</Link>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
