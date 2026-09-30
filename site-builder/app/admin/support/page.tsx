"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../../../components/AdminShell";
import { getSupabaseBrowserClient } from "../../../lib/supabase-browser";
import type { SupportDiagnosis } from "../../../lib/support-diagnostics";

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
