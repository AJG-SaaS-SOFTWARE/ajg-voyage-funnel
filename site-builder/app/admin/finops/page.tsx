"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../../../components/AdminShell";
import { getAdminAiFinops } from "../../../lib/admin";
import { usdCost, type AiFinopsReport, type FinopsAlert } from "../../../lib/ai-finops-report";

type ReportResult = { report: AiFinopsReport; alerts: FinopsAlert[]; generatedAt: string };
const dimensions = { plan: "Par offre", user: "Par compte", site: "Par site", operation: "Par opération demandée", model: "Par modèle demandé", day: "Par jour (UTC)" };

export default function FinopsPage() {
  const [month, setMonth] = useState("");
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setResult(null);
    getAdminAiFinops(month || undefined, controller.signal).then(data => {
      if (!controller.signal.aborted) setResult(data);
    }).catch(() => {
      if (!controller.signal.aborted) setError("Rapport indisponible ou accès administrateur requis. Vérifiez votre session, puis réessayez.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [month, refresh]);

  const report = result?.report;
  return (
    <AdminShell active="finops" eyebrow="FinOps IA" title="Coûts et budgets IA" description="Coûts fournisseur estimés en USD, provisions incluses. Les montants ne sont pas encore rapprochés des factures fournisseur." actions={<button className="button secondary" onClick={() => setRefresh(value => value + 1)} disabled={loading}>Actualiser</button>}>
      <section className="panel">
        <label htmlFor="finops-month">Mois du rapport (UTC)</label>{" "}
        <input id="finops-month" type="month" value={month || report?.month || ""} onChange={event => setMonth(event.target.value)} />
        {loading ? <p role="status">Chargement du rapport…</p> : null}
        {error ? <p role="alert">{error}</p> : null}
        {result ? <p>Actualisé le {new Date(result.generatedAt).toLocaleString("fr-FR")}. Les plafonds et leur exposition sont ceux du jour et du mois courants, même pour un rapport historique.</p> : null}
      </section>
      {report ? <>
        <section className="admin-metrics">
          <article><b>{usdCost(report.totalCostMicros)}</b><span>coût et provisions du mois</span></article>
          <article><b>{report.calls}</b><span>appels fournisseur</span></article>
          <article><b>{report.uncertainCalls}</b><span>appels à rapprocher</span></article>
          <article><b>{report.launchRights.completedRights}</b><span>droits BUILD entièrement consommés · cumul</span></article>
        </section>
        <section className="panel">
          <h2>Budgets AJG actuels</h2>
          <p>Jour : {usdCost(report.budgetExposure.dayMicros)} / {usdCost(report.policy.global_daily_micros)} · Mois : {usdCost(report.budgetExposure.monthMicros)} / {usdCost(report.policy.global_monthly_micros)}.</p>
          <p>IA : {report.policy.ai_enabled ? "active" : "suspendue"} · Opérations lourdes : {report.policy.heavy_enabled ? "actives" : "suspendues"}.</p>
          {result!.alerts.length ? <ul>{result!.alerts.map(alert => <li key={alert.key}><strong>{alert.level === "critical" ? "Critique" : alert.level === "warning" ? "À vérifier" : "Information"}</strong> : {alert.message}</li>)}</ul> : <p>Aucun seuil d’alerte global atteint.</p>}
          <p>Les alertes de marge en euros restent indisponibles tant que le taux de change daté et les revenus du compte ne sont pas rapprochés.</p>
        </section>
        {report.calls === 0 ? <section className="panel"><h2>Aucune donnée IA pour ce mois</h2><p>Le coût moyen et le P95 ne peuvent pas encore être évalués. Aucun coût bêta réel n’est déduit d’une absence d’appels.</p></section> : null}
        <section className="panel">
          <h2>Générations complètes</h2>
          <p>Chaque demande regroupe tous ses appels internes. Moyenne et P95 portent sur les succès au coût connu ; les échecs et appels historiques sans rattachement restent comptés dans les coûts globaux. Résultats inconnus : {report.requests.reduce((sum, row) => sum + (row.unknownOutcomes || 0), 0)} demande(s), exclues des succès mesurés.</p>
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th scope="col">Opération</th><th scope="col">Tentatives</th><th scope="col">Succès mesurés</th><th scope="col">Moyenne</th><th scope="col">P95</th><th scope="col">Coût des non-succès</th></tr></thead><tbody>
            {report.requests.map(row => <tr key={row.operation}><td>{row.operation}</td><td>{row.attempts}</td><td>{row.measuredSuccesses}</td><td>{usdCost(row.meanMicros)}</td><td>{usdCost(row.p95Micros)}</td><td>{usdCost(row.failedCostMicros)}</td></tr>)}
          </tbody></table></div>
          {!report.requests.length ? <p>Aucune demande complète mesurable.</p> : null}
          <h3>Création IA achetée : coût cumulé par droit BUILD</h3>
          <p>{report.launchRights.measuredRights} droit(s) mesuré(s) · Moyenne à ce jour : {usdCost(report.launchRights.meanToDateMicros)} · P95 à ce jour : {usdCost(report.launchRights.p95ToDateMicros)} · Moyenne des droits entièrement consommés : {usdCost(report.launchRights.meanCompletedMicros)}.</p>
          <p>Ces statistiques BUILD couvrent toute la durée du droit, tous mois confondus, y compris les essais échoués. Un droit en cours ne représente pas encore le coût final de la prestation.</p>
        </section>
        <section className="panel">
          <h2>Coût mensuel des comptes utilisant l’IA</h2>
          <p>BUILD exclu. Comptes sans appel et comptes supprimés exclus : ces valeurs ne sont pas une moyenne de tous les abonnés. Les provisions sont incluses.</p>
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th scope="col">Offre</th><th scope="col">Comptes avec IA</th><th scope="col">Moyenne</th><th scope="col">Médiane</th><th scope="col">P95</th></tr></thead><tbody>{report.planAccounts.map(row => <tr key={row.plan}><td>{row.plan}</td><td>{row.accountsWithAi}</td><td>{usdCost(row.meanMicros)}</td><td>{usdCost(row.medianMicros)}</td><td>{usdCost(row.p95Micros)}</td></tr>)}</tbody></table></div>
          {!report.planAccounts.length ? <p>Aucun compte avec coût IA observé.</p> : null}
        </section>
        {Object.entries(dimensions).map(([key, label]) => {
          const dimension = report.dimensions[key];
          if (!dimension) return null;
          return <section className="panel" key={key}><h2>{label}</h2><p>{Math.min(dimension.totalRows, 50)} / {dimension.totalRows} lignes affichées, triées par coût. Les totaux incluent toutes les lignes.</p><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th scope="col">Identifiant</th><th scope="col">Coût et provisions</th><th scope="col">Appels</th><th scope="col">À rapprocher</th></tr></thead><tbody>{dimension.rows.map(row => <tr key={row.key}><td>{row.key === "deleted" ? "Supprimé / anonymisé" : row.key}</td><td>{usdCost(row.costMicros)}</td><td>{row.calls}</td><td>{row.uncertainCalls}</td></tr>)}</tbody></table></div></section>;
        })}
      </> : null}
    </AdminShell>
  );
}
