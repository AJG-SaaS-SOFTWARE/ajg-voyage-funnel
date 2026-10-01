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
  const [state, setState] = useState<"loading" | "ready" | "denied">("loading");
  const [message, setMessage] = useState("");

  async function load() {
    const token = await sessionToken();
    const response = await fetch("/api/admin/support", {
      headers: { Authorization: "Bearer " + token },
      cache: "no-store"
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error || "Support indisponible.");
    setTickets(body.tickets || []);
    setMetrics(body.metrics || null);
    setState("ready");
  }

  useEffect(() => {
    void load().catch(() => setState("denied"));
  }, []);

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
