"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { LanguageSwitch } from "../../components/LanguageSwitch";
import { useProductLocale } from "../../lib/product-i18n";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";
import type { SupportDiagnosis } from "../../lib/support-diagnostics";

type Ticket = {
  id: string;
  category: string;
  severity: string;
  subject: string;
  message: string;
  status: string;
  diagnosis: SupportDiagnosis;
  client_action: string | null;
  created_at: string;
};

type SupportPayload = {
  health: { siteId: string | null; diagnosis: SupportDiagnosis };
  tickets: Ticket[];
};

export default function SupportPage() {
  const { tr } = useProductLocale();
  const [payload, setPayload] = useState<SupportPayload | null>(null);
  const [state, setState] = useState<"loading" | "guest" | "ready" | "error">("loading");
  const [category, setCategory] = useState("bug");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [recheckingId, setRecheckingId] = useState<string | null>(null);

  async function token() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  async function load() {
    const accessToken = await token();
    if (!accessToken) {
      setState("guest");
      return;
    }
    const response = await fetch("/api/support/tickets", {
      headers: { Authorization: "Bearer " + accessToken },
      cache: "no-store"
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error || tr("Support indisponible.", "Support is unavailable."));
    setPayload(body);
    setState("ready");
  }

  useEffect(() => {
    void load().catch(() => setState("error"));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const accessToken = await token();
    if (!accessToken) {
      setState("guest");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ category, subject, message }),
        cache: "no-store"
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || tr("Création impossible.", "Unable to create the ticket."));
      setSubject("");
      setMessage("");
      setNotice(
        body?.ticket?.status === "waiting_customer"
          ? tr("Diagnostic terminé : une action vous est proposée ci-dessous avant escalade.", "Diagnosis complete: an action is suggested below before escalation.")
          : tr("Ticket enregistré avec son diagnostic technique.", "Ticket saved with its technical diagnosis.")
      );
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : tr("Création impossible.", "Unable to create the ticket."));
    } finally {
      setBusy(false);
    }
  }

  async function recheck(ticketId: string) {
    const accessToken = await token();
    if (!accessToken) {
      setState("guest");
      return;
    }
    setRecheckingId(ticketId);
    setNotice("");
    try {
      const response = await fetch("/api/support/tickets", {
        method: "PATCH",
        headers: {
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ id: ticketId }),
        cache: "no-store"
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || tr("Nouveau diagnostic impossible.", "Unable to run a new diagnosis."));
      }

      const nextStatus = body?.ticket?.status;
      setNotice(
        nextStatus === "resolved"
          ? tr("Le problème diagnostiqué n’est plus détecté : la demande a été résolue automatiquement.", "The diagnosed issue is no longer detected: the request was resolved automatically.")
          : nextStatus === "diagnosed"
            ? tr("Le problème nécessite maintenant une vérification AJG. Votre demande a été escaladée.", "The issue now requires AJG review. Your request has been escalated.")
            : tr("L’action recommandée reste nécessaire. Le diagnostic a été actualisé.", "The recommended action is still required. The diagnosis has been refreshed.")
      );
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : tr("Nouveau diagnostic impossible.", "Unable to run a new diagnosis."));
    } finally {
      setRecheckingId(null);
    }
  }

  const health = payload?.health.diagnosis;

  return (
    <main className="plans-page">
      <section className="plans-hero">
        <div className="builder-language-row">
          <p className="eyebrow">AJG Support Center</p>
          <LanguageSwitch compact />
        </div>
        <h1>{tr("Diagnostiquer avant de contacter le support", "Diagnose before contacting support")}</h1>
        <p>{tr(
          "Le Builder vérifie automatiquement les causes courantes avant de transmettre un incident à AJG.",
          "The Builder automatically checks common causes before escalating an incident to AJG."
        )}</p>
        <div className="actions">
          <Link className="button secondary" href="/">{tr("Tableau de bord", "Dashboard")}</Link>
          <Link className="button secondary" href="/builder">{tr("Ouvrir le Builder", "Open Builder")}</Link>
        </div>
      </section>

      {state === "guest" ? (
        <section className="panel">
          <h2>{tr("Connexion requise", "Sign-in required")}</h2>
          <p>{tr("Connectez-vous pour lancer le diagnostic de votre site et suivre vos tickets.", "Sign in to diagnose your website and track your tickets.")}</p>
          <Link className="button primary" href="/login">{tr("Se connecter", "Sign in")}</Link>
        </section>
      ) : null}

      {state === "loading" ? <section className="panel"><p>{tr("Diagnostic en cours…", "Running diagnosis…")}</p></section> : null}
      {state === "error" ? <section className="panel"><p>{tr("Le centre de diagnostic est momentanément indisponible.", "The diagnostic center is temporarily unavailable.")}</p></section> : null}

      {state === "ready" && health ? (
        <>
          <section className="panel">
            <p className="eyebrow">Health Center</p>
            <h2>
              {health.overall === "healthy"
                ? tr("Aucune anomalie courante détectée", "No common issue detected")
                : health.overall === "action"
                  ? tr("Une action est recommandée", "An action is recommended")
                  : tr("Un incident technique est détecté", "A technical incident was detected")}
            </h2>
            <ul>
              {health.checks.map((check) => (
                <li key={check.key}>
                  <strong>
                    {check.status === "healthy" ? "✓" : check.status === "action" ? "○" : "×"} {check.label}
                  </strong>
                  {" — "}{check.detail}
                  {check.clientAction ? <span> {check.clientAction}</span> : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <h2>{tr("Ouvrir une demande", "Open a request")}</h2>
            <p>{tr(
              "Votre diagnostic actuel sera joint automatiquement au ticket. N'ajoutez jamais de mot de passe, clé API ou donnée bancaire.",
              "Your current diagnosis will automatically be attached to the ticket. Never include passwords, API keys or banking details."
            )}</p>
            <form className="feedback-form" onSubmit={submit}>
              <label>{tr("Motif", "Category")}
                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                  <option value="bug">Bug</option>
                  <option value="domain">{tr("Domaine / DNS", "Domain / DNS")}</option>
                  <option value="publication">{tr("Publication", "Publishing")}</option>
                  <option value="billing">{tr("Facturation", "Billing")}</option>
                  <option value="ai">IA</option>
                  <option value="data">{tr("Données", "Data")}</option>
                  <option value="other">{tr("Autre", "Other")}</option>
                </select>
              </label>
              <label>{tr("Sujet", "Subject")}
                <input maxLength={160} value={subject} onChange={(event) => setSubject(event.target.value)} />
              </label>
              <label className="feedback-message">{tr("Décrivez ce que vous essayiez de faire", "Describe what you were trying to do")}
                <textarea rows={7} maxLength={4000} value={message} onChange={(event) => setMessage(event.target.value)} />
              </label>
              <button className="button primary" disabled={busy || subject.trim().length < 3 || message.trim().length < 10}>
                {busy ? tr("Diagnostic et envoi…", "Diagnosing and sending…") : tr("Diagnostiquer et envoyer", "Diagnose and send")}
              </button>
            </form>
            {notice ? <p role="status">{notice}</p> : null}
          </section>

          <section className="panel">
            <h2>{tr("Mes demandes", "My requests")}</h2>
            {payload?.tickets.length ? (
              <ul>
                {payload.tickets.map((ticket) => (
                  <li key={ticket.id}>
                    <strong>{ticket.subject}</strong> · {ticket.status} · {new Date(ticket.created_at).toLocaleDateString()}
                    <br />
                    <span>{ticket.message}</span>
                    {ticket.client_action ? <><br /><b>{tr("Action proposée :", "Suggested action:")}</b> {ticket.client_action}</> : null}
                    {ticket.status === "waiting_customer" ? (
                      <>
                        <br />
                        <button
                          className="button secondary"
                          onClick={() => void recheck(ticket.id)}
                          disabled={recheckingId === ticket.id}
                        >
                          {recheckingId === ticket.id
                            ? tr("Nouveau diagnostic…", "Running diagnosis…")
                            : tr("J’ai corrigé — relancer le diagnostic", "I fixed it — run diagnosis again")}
                        </button>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : <p>{tr("Aucune demande ouverte.", "No support request yet.")}</p>}
          </section>
        </>
      ) : null}
    </main>
  );
}
