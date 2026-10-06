"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../../../components/AdminShell";
import { getSupabaseBrowserClient } from "../../../lib/supabase-browser";
import type { SupportDiagnosis } from "../../../lib/support-diagnostics";

type SupportMetrics = {
  windowDays: 30;
  activeClients: number;
  ticketsCreated: number;
  escalatedTickets: number;
  adminTouchedTickets: number;
  autoResolvedTickets: number;
  selfServiceResolvedTickets: number;
  escalatedPerActiveClient: number;
  adminTouchedPerActiveClient: number;
  selfServiceResolutionRate: number;
  byCategory: Array<{ category: string; count: number }>;
  remediation: {
    attempted: number;
    succeeded: number;
    noChange: number;
    failed: number;
    successRate: number;
    byCode: Array<{ code: string; count: number }>;
  };
};

type PlatformProbe = {
  host: string;
  dns: "ok" | "nxdomain" | "error";
  https: "ok" | "unavailable" | "skipped";
  httpStatus: number | null;
};

type PlatformHealth = {
  overall: "healthy" | "warning" | "incident";
  app: PlatformProbe;
  publicDomain: PlatformProbe;
  managedDomainCanary: PlatformProbe;
  runtime: {
    checked: boolean;
    lookbackMinutes: number;
    sampledLogs: number;
    errorCount: number;
    fatalCount: number;
    http5xxCount: number;
    truncated: boolean;
    status: "healthy" | "warning" | "incident" | "unknown";
  };
  nextAction: string | null;
};

type SupportOperationsRun = {
  id: number;
  started_at: string;
  completed_at: string | null;
  status: "running" | "healthy" | "attention" | "failed";
  reconcile_scanned: number;
  reconcile_resolved: number;
  reconcile_escalated: number;
  reconcile_waiting: number;
  reconcile_failed: number;
  remediation_scanned: number;
  remediation_eligible: number;
  remediation_attempted: number;
  remediation_succeeded: number;
  remediation_no_change: number;
  remediation_failed: number;
  runtime_status: "healthy" | "warning" | "incident" | "unknown";
  runtime_error_count: number;
  runtime_fatal_count: number;
  runtime_http5xx_count: number;
  runtime_deployment_id: string | null;
  reported_to_run: boolean;
  report_reason: string | null;
  errors: string[];
};

type SupportOperationsStatus = {
  latest: SupportOperationsRun | null;
  attentionRequired: boolean;
  runs: SupportOperationsRun[];
};

type AdminTicket = {
  id: string;
  category: string;
  severity: string;
  subject: string;
  message: string;
  status: string;
  diagnosis: SupportDiagnosis;
  client_action: string | null;
  resolution_code: string | null;
  created_at: string;
};

const statuses = ["diagnosed","waiting_customer","in_progress","resolved","closed"] as const;

async function sessionToken() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Session expirée.");
  return session.access_token;
}

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [metrics, setMetrics] = useState<SupportMetrics | null>(null);
  const [platform, setPlatform] = useState<PlatformHealth | null>(null);
  const [agent, setAgent] = useState<SupportOperationsStatus | null>(null);
  const [agentRunning, setAgentRunning] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "denied">("loading");
  const [message, setMessage] = useState("");

  async function load() {
    const token = await sessionToken();
    const [response, agentResponse] = await Promise.all([
      fetch("/api/admin/support", {
        headers: { Authorization: "Bearer " + token },
        cache: "no-store"
      }),
      fetch("/api/admin/support-operations", {
        headers: { Authorization: "Bearer " + token },
        cache: "no-store"
      }).catch(() => null)
    ]);
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error || "Support indisponible.");
    const agentBody = agentResponse && agentResponse.ok
      ? await agentResponse.json().catch(() => null)
      : null;
    setTickets(body.tickets || []);
    setMetrics(body.metrics || null);
    setPlatform(body.platform || null);
    setAgent(agentBody);
    setState("ready");
  }

  useEffect(() => {
    void load().catch(() => setState("denied"));
  }, []);

  async function runAgentNow() {
    setMessage("");
    setAgentRunning(true);
    try {
      const token = await sessionToken();
      const response = await fetch("/api/admin/support-operations", {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
        cache: "no-store"
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.detail || body?.error || "Exécution impossible.");
      setAgent(body);
      await load();
      setMessage(
        body?.latest?.status === "failed"
          ? "Agent RUN exécuté : une erreur technique reste à traiter."
          : body?.latest?.status === "attention"
            ? "Agent RUN exécuté : les corrections sûres sont terminées, une exception reste supervisée."
            : "Agent RUN exécuté : support et runtime sont sous contrôle."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Exécution impossible.");
    } finally {
      setAgentRunning(false);
    }
  }

  async function update(id: string, status: string) {
    setMessage("");
    try {
      const token = await sessionToken();
      const response = await fetch("/api/admin/support", {
        method: "PATCH",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ id, status }),
        cache: "no-store"
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Mise à jour impossible.");
      await load();
      setMessage("Ticket mis à jour.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Mise à jour impossible.");
    }
  }

  const openCount = tickets.filter((ticket) => !["resolved","closed"].includes(ticket.status)).length;
  const incidentCount = tickets.filter((ticket) => ticket.diagnosis?.overall === "incident" && !["resolved","closed"].includes(ticket.status)).length;

  return (
    <AdminShell
      active="support"
      eyebrow="AJG Support"
      title="Tickets et diagnostics"
      description="Les demandes sont enrichies par un diagnostic serveur avant traitement humain. Les causes répétitives devront être converties en automatisations."
    >
      {state === "loading" ? <p>Chargement…</p> : null}
      {state === "denied" ? <section className="panel"><h2>Accès restreint</h2><p>Votre compte n'a pas le rôle administrateur.</p></section> : null}
      {state === "ready" ? (
        <>
          {platform ? (
            <section className="panel">
              <p className="eyebrow">Infrastructure ELTARA</p>
              <h2>État de santé de la plateforme</h2>
              <div className="admin-metrics">
                <article>
                  <b>{platform.app.dns === "ok" && platform.app.https === "ok" ? "OK" : "ALERTE"}</b>
                  <span>secours applicatif · {platform.app.host}</span>
                </article>
                <article>
                  <b>{platform.publicDomain.dns === "ok" && platform.publicDomain.https === "ok" ? "OK" : platform.publicDomain.dns === "nxdomain" ? "NXDOMAIN" : "ALERTE"}</b>
                  <span>domaine ELTARA · {platform.publicDomain.host}</span>
                </article>
                <article>
                  <b>{platform.managedDomainCanary.dns === "ok" && platform.managedDomainCanary.https === "ok" ? "OK" : platform.managedDomainCanary.dns === "nxdomain" ? "NXDOMAIN" : "ALERTE"}</b>
                  <span>sous-domaines clients · {platform.managedDomainCanary.host}</span>
                </article>
                <article>
                  <b>{platform.runtime.status === "healthy" ? "0" : platform.runtime.status === "unknown" ? "—" : platform.runtime.errorCount + platform.runtime.http5xxCount}</b>
                  <span>runtime · erreurs/5xx · {platform.runtime.lookbackMinutes} min{platform.runtime.truncated ? " · échantillon borné" : ""}</span>
                </article>
                <article>
                  <b>{platform.overall === "healthy" ? "SAIN" : platform.overall === "warning" ? "À CORRIGER" : "INCIDENT"}</b>
                  <span>état global</span>
                </article>
              </div>
              {platform.nextAction ? (
                <p className="plans-note" role="alert"><strong>Action requise :</strong> {platform.nextAction}</p>
              ) : null}
            </section>
          ) : null}

          <section className={
            "panel support-run-agent " +
            (agent?.attentionRequired ? "needs-attention" : agent?.latest ? "healthy" : "unknown")
          }>
            <div className="support-run-agent-head">
              <div>
                <p className="eyebrow">RUN autonome</p>
                <h2>
                  {agent?.latest
                    ? agent.attentionRequired
                      ? "Exception à superviser"
                      : "Agent Support opérationnel"
                    : "Journal RUN en attente"}
                </h2>
                <p>
                  Réconciliation des tickets, auto-remédiation allowlistée et surveillance runtime sont maintenant exécutées par un agent dédié. Les incidents runtime sont transmis au cockpit AJG sans contenu client.
                </p>
              </div>
              <button className="button secondary" disabled={agentRunning} onClick={() => void runAgentNow()}>
                {agentRunning ? "Analyse en cours…" : "Exécuter maintenant"}
              </button>
            </div>
            {agent?.latest ? (
              <>
                <div className="admin-metrics">
                  <article><b>{agent.latest.reconcile_resolved}</b><span>tickets auto-résolus</span></article>
                  <article><b>{agent.latest.reconcile_escalated}</b><span>tickets escaladés</span></article>
                  <article><b>{agent.latest.remediation_succeeded}</b><span>réparations réussies</span></article>
                  <article><b>{agent.latest.remediation_failed + agent.latest.reconcile_failed}</b><span>échecs non résolus</span></article>
                  <article><b>{agent.latest.runtime_status === "incident" ? "INCIDENT" : agent.latest.runtime_status === "warning" ? "SURVEILLER" : agent.latest.runtime_status === "healthy" ? "SAIN" : "—"}</b><span>runtime production</span></article>
                  <article><b>{agent.latest.reported_to_run ? "OUI" : "NON"}</b><span>incident transmis au cockpit</span></article>
                </div>
                <p className="plans-note">
                  Dernière exécution : {agent.latest.completed_at ? new Date(agent.latest.completed_at).toLocaleString("fr-FR") : "en cours"} ·
                  {" "}{agent.runs.length} exécution(s) récente(s) conservée(s).
                </p>
                {agent.latest.errors?.length ? (
                  <div className="support-run-agent-errors">
                    {agent.latest.errors.slice(0, 3).map((error) => <small key={error}>{error}</small>)}
                  </div>
                ) : null}
              </>
            ) : <p>Le cron horaire initialisera automatiquement le journal. Vous pouvez aussi lancer l’agent maintenant.</p>}
          </section>

          <section className="admin-metrics">
            <article><b>{openCount}</b><span>tickets ouverts</span></article>
            <article><b>{incidentCount}</b><span>incidents détectés</span></article>
            <article><b>{tickets.filter((ticket) => ticket.status === "waiting_customer").length}</b><span>actions côté client</span></article>
            <article><b>{tickets.filter((ticket) => ticket.status === "resolved").length}</b><span>résolus</span></article>
          </section>

          {metrics ? (
            <>
              <section className="panel">
                <p className="eyebrow">30 derniers jours</p>
                <h2>Autonomie du support</h2>
                <div className="admin-metrics">
                  <article><b>{metrics.activeClients}</b><span>clients actifs publiés</span></article>
                  <article><b>{metrics.ticketsCreated}</b><span>tickets créés</span></article>
                  <article><b>{metrics.escalatedTickets}</b><span>tickets escaladés AJG</span></article>
                  <article><b>{metrics.adminTouchedTickets}</b><span>tickets touchés par un admin</span></article>
                  <article><b>{metrics.selfServiceResolvedTickets}</b><span>résolus sans admin</span></article>
                  <article>
                    <b>{(metrics.selfServiceResolutionRate * 100).toFixed(0)}%</b>
                    <span>résolution sans admin / tickets créés</span>
                  </article>
                  <article>
                    <b>{metrics.activeClients ? metrics.escalatedPerActiveClient.toFixed(2) : "—"}</b>
                    <span>escalades / client actif · cible &lt; 0,15</span>
                  </article>
                  <article>
                    <b>{metrics.activeClients ? metrics.adminTouchedPerActiveClient.toFixed(2) : "—"}</b>
                    <span>interventions admin / client actif</span>
                  </article>
                </div>
              </section>

              <section className="panel">
                <p className="eyebrow">Auto-remédiation</p>
                <h2>Réparations techniques</h2>
                <div className="admin-metrics">
                  <article><b>{metrics.remediation.attempted}</b><span>tentatives</span></article>
                  <article><b>{metrics.remediation.succeeded}</b><span>réussies</span></article>
                  <article><b>{metrics.remediation.failed}</b><span>échouées</span></article>
                  <article>
                    <b>{(metrics.remediation.successRate * 100).toFixed(0)}%</b>
                    <span>taux de réussite</span>
                  </article>
                </div>
                {metrics.remediation.byCode.length ? (
                  <p>
                    <strong>Résultats fréquents :</strong>{" "}
                    {metrics.remediation.byCode
                      .slice(0, 5)
                      .map((item) => `${item.code} (${item.count})`)
                      .join(" · ")}
                  </p>
                ) : <p>Aucune remédiation enregistrée sur la période.</p>}
                {metrics.byCategory.length ? (
                  <p>
                    <strong>Motifs de tickets :</strong>{" "}
                    {metrics.byCategory
                      .slice(0, 5)
                      .map((item) => `${item.category} (${item.count})`)
                      .join(" · ")}
                  </p>
                ) : null}
              </section>
            </>
          ) : (
            <section className="panel">
              <p>Les KPI support sur 30 jours sont temporairement indisponibles. La file de tickets reste accessible.</p>
            </section>
          )}
          {message ? <p role="status">{message}</p> : null}
          <section className="panel">
            <h2>File de support</h2>
            {tickets.length ? tickets.map((ticket) => (
              <article key={ticket.id} className="panel">
                <p className="eyebrow">{ticket.category} · {ticket.severity} · {new Date(ticket.created_at).toLocaleString("fr-FR")}</p>
                <h3>{ticket.subject}</h3>
                <p>{ticket.message}</p>
                <p><strong>Diagnostic :</strong> {ticket.diagnosis?.overall || "indisponible"}</p>
                {ticket.client_action ? <p><strong>Action client proposée :</strong> {ticket.client_action}</p> : null}
                {ticket.diagnosis?.checks?.length ? (
                  <ul>{ticket.diagnosis.checks.map((check) => <li key={check.key}>{check.label} — {check.status} — {check.detail}</li>)}</ul>
                ) : null}
                <div className="actions">
                  {statuses.map((status) => (
                    <button key={status} className={ticket.status === status ? "button primary" : "button secondary"} onClick={() => update(ticket.id, status)}>
                      {status}
                    </button>
                  ))}
                </div>
              </article>
            )) : <p>Aucun ticket client.</p>}
          </section>
        </>
      ) : null}
    </AdminShell>
  );
}
