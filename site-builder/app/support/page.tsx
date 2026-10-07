"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { LanguageSwitch } from "../../components/LanguageSwitch";
import { useProductLocale } from "../../lib/product-i18n";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";
import type { SupportDiagnosis } from "../../lib/support-diagnostics";
import { supportGuidanceForDiagnosis } from "../../lib/support-guidance";
import { supportArticlesForLocale } from "../../lib/support-knowledge";

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
  const { locale, tr } = useProductLocale();
  const [payload, setPayload] = useState<SupportPayload | null>(null);
  const [state, setState] = useState<"loading" | "guest" | "ready" | "error">("loading");
  const [category, setCategory] = useState("bug");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [healthNotice, setHealthNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [recheckingId, setRecheckingId] = useState<string | null>(null);
  const [repairing, setRepairing] = useState(false);
  const [topic, setTopic] = useState("");
  const submitting = useRef(false);
  const requestIdentity = useRef<{ id: string; payload: string } | null>(null);
  const confirmedRequest = useRef<string | null>(null);

  function draftPayload() {
    return JSON.stringify({ category, subject: subject.trim(), message: message.trim() });
  }
  const latestDraft = useRef("");
  latestDraft.current = draftPayload();

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
    if (response.status === 401) {
      setState("guest");
      return;
    }
    if (!response.ok) throw new Error(body?.error || tr("Support indisponible.", "Support is unavailable."));
    const pending = requestIdentity.current;
    if (pending && Array.isArray(body?.tickets) && body.tickets.some((ticket: Ticket) => ticket.id === pending.id)) {
      confirmedRequest.current = pending.id;
      requestIdentity.current = null;
      if (latestDraft.current === pending.payload) {
        setSubject("");
        setMessage("");
      }
      setNotice(tr("Votre demande a été retrouvée et est enregistrée. Aucun nouvel envoi n’est nécessaire.", "Your request was found and is saved. No new submission is needed."));
    }
    setPayload(body);
    setState("ready");
  }

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("topic") || "";
    if (["domain", "billing", "publishing", "ai", "data"].includes(requested)) {
      setTopic(requested);
      setCategory(requested === "domain" ? "domain" : requested === "publishing" ? "publication" : requested);
    }
    void load().catch(() => setState("error"));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setNotice("");
    let activeRequestId: string | null = null;
    try {
      const accessToken = await token();
      if (!accessToken) {
        setState("guest");
        return;
      }
      const submittedPayload = draftPayload();
      const retrying = Boolean(requestIdentity.current);
      if (requestIdentity.current && requestIdentity.current.payload !== submittedPayload) {
        throw new Error(tr(
          "Un envoi précédent reste à vérifier. Actualisez vos demandes avant d’envoyer un autre contenu.",
          "A previous submission still needs checking. Refresh your requests before sending different content."
        ));
      }
      requestIdentity.current ??= { id: crypto.randomUUID(), payload: submittedPayload };
      const requestId = requestIdentity.current.id;
      activeRequestId = requestId;
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ ...JSON.parse(submittedPayload), requestId }),
        cache: "no-store"
      }).catch(() => {
        throw new Error(tr(
          "La réponse à l’envoi n’a pas été reçue. La demande a peut-être été enregistrée : actualisez vos demandes avant de réessayer.",
          "No submission response was received. The request may have been saved: refresh your requests before trying again."
        ));
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        // These responses are emitted before insertion by this API. They can
        // release a first attempt, never an earlier uncertain submission.
        if (!retrying && [400, 401, 429].includes(response.status)) requestIdentity.current = null;
        if (response.status === 401) setState("guest");
        if (response.status >= 500) {
          throw new Error(tr(
            "L’envoi n’a pas pu être confirmé. Actualisez vos demandes avant de réessayer.",
            "Submission could not be confirmed. Refresh your requests before trying again."
          ));
        }
        throw new Error(body?.error || tr("Création impossible.", "Unable to create the ticket."));
      }
      if (response.status !== 201 || body?.ticket?.id !== requestId) {
        throw new Error(tr(
          "L’envoi n’a pas pu être confirmé. Actualisez vos demandes avant de réessayer.",
          "Submission could not be confirmed. Refresh your requests before trying again."
        ));
      }
      confirmedRequest.current = requestId;
      requestIdentity.current = null;
      if (latestDraft.current === submittedPayload) {
        setSubject("");
        setMessage("");
      }
      const confirmation =
        body?.ticket?.status === "waiting_customer"
          ? tr("Demande enregistrée. Retrouvez l’action proposée dans « Mes demandes » avant escalade.", "Request saved. Find the suggested action in My requests before escalation.")
          : tr("Ticket enregistré avec son diagnostic technique.", "Ticket saved with its technical diagnosis.");
      setNotice(confirmation);
      try {
        await load();
      } catch {
        setState("error");
        setNotice(confirmation + " " + tr(
          "La liste n’a pas pu être actualisée. Votre demande est déjà enregistrée : ne l’envoyez pas une seconde fois.",
          "The list could not be refreshed. Your request is already saved: do not submit it again."
        ));
      }
    } catch (error) {
      setNotice(activeRequestId && confirmedRequest.current === activeRequestId
        ? tr("Votre demande a été retrouvée et est enregistrée. Aucun nouvel envoi n’est nécessaire.", "Your request was found and is saved. No new submission is needed.")
        : error instanceof Error ? error.message : tr("Création impossible.", "Unable to create the ticket."));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  async function diagnose() {
    setDiagnosing(true);
    setHealthNotice("");
    try {
      await load();
      setHealthNotice(tr(
        "Diagnostic actualisé. Les contrôles techniques de votre site viennent d’être relancés.",
        "Diagnosis refreshed. Your website technical checks have just been run again."
      ));
    } catch (error) {
      setHealthNotice(error instanceof Error ? error.message : tr(
        "Nouveau diagnostic impossible.",
        "Unable to run a new diagnosis."
      ));
    } finally {
      setDiagnosing(false);
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
            ? tr("Le problème nécessite maintenant une vérification par l’équipe ELTARA. Votre demande a été escaladée.", "The issue now requires ELTARA team review. Your request has been escalated.")
            : tr("L’action recommandée reste nécessaire. Le diagnostic a été actualisé.", "The recommended action is still required. The diagnosis has been refreshed.")
      );
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : tr("Nouveau diagnostic impossible.", "Unable to run a new diagnosis."));
    } finally {
      setRecheckingId(null);
    }
  }

  async function repair() {
    const accessToken = await token();
    const siteId = payload?.health.siteId;
    const action = payload?.health.diagnosis.repairActions?.[0];
    if (!accessToken || !siteId || !action) return;
    setRepairing(true);
    setHealthNotice("");
    try {
      const response = await fetch("/api/support/remediate", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ siteId, action }),
        cache: "no-store"
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || tr("Correction automatique impossible.", "Automatic repair failed."));
      setHealthNotice(
        body?.result?.status === "succeeded"
          ? tr("Correction technique appliquée. Le diagnostic a été actualisé.", "Technical repair applied. The diagnosis has been refreshed.")
          : tr("La correction automatique n’a pas suffi. Le diagnostic a été actualisé et peut être transmis à l’équipe ELTARA.", "Automatic repair was not sufficient. The diagnosis has been refreshed and can be escalated to the ELTARA team.")
      );
      await load();
    } catch (error) {
      setHealthNotice(error instanceof Error ? error.message : tr("Correction automatique impossible.", "Automatic repair failed."));
    } finally {
      setRepairing(false);
    }
  }

  const health = payload?.health.diagnosis;
  const guidance = health ? supportGuidanceForDiagnosis(health.checks, locale) : [];
  const allKnowledgeArticles = supportArticlesForLocale(locale);
  const knowledgeArticles = topic
    ? allKnowledgeArticles.filter((article) => article.category === topic)
    : allKnowledgeArticles;

  return (
    <main className="plans-page">
      <section className="plans-hero">
        <div className="builder-language-row">
          <p className="eyebrow">ELTARA Support Center</p>
          <LanguageSwitch compact />
        </div>
        <h1>{tr("Aide et demandes", "Help and requests")}</h1>
        <p>{tr(
          "Signalez un problème et retrouvez vos demandes ici. ELTARA joint les contrôles techniques disponibles pour faciliter leur traitement.",
          "Report a problem and track your requests here. ELTARA attaches available technical checks to help the team review them."
        )}</p>
        <div className="actions">
          <a className="button primary" href={state === "guest" ? "/login" : "#new-request"}>{tr("Signaler un problème", "Report a problem")}</a>
          <Link className="button secondary" href="/feedback">{tr("Proposer une amélioration", "Suggest an improvement")}</Link>
          <Link className="button secondary" href="/">{tr("Tableau de bord", "Dashboard")}</Link>
          <Link className="button secondary" href="/builder">{tr("Ouvrir ELTARA", "Open ELTARA")}</Link>
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
      {state === "error" ? (
        <section className="panel">
          <p>{tr("Le diagnostic ou la liste des demandes est momentanément indisponible. Vous pouvez toujours préparer votre message.", "Diagnosis or the request list is temporarily unavailable. You can still prepare your message.")}</p>
          <button className="button secondary" onClick={() => void diagnose()} disabled={diagnosing}>
            {diagnosing ? tr("Actualisation…", "Refreshing…") : tr("Actualiser mes demandes", "Refresh my requests")}
          </button>
          {healthNotice ? <p role="status">{healthNotice}</p> : null}
        </section>
      ) : null}

      {state !== "guest" ? (
        <section className="panel" id="new-request" aria-labelledby="new-request-title">
          <h2 id="new-request-title">{tr("Ouvrir une demande", "Open a request")}</h2>
          <p>{tr(
            "Indiquez le problème en quelques mots. Le diagnostic est ajouté lors de l’envoi. N’ajoutez jamais de mot de passe, clé API, donnée bancaire ou information personnelle sensible.",
            "Describe the problem briefly. Diagnosis is added when you submit. Never include passwords, API keys, banking details or sensitive personal information."
          )}</p>
          <form className="feedback-form" onSubmit={submit} aria-busy={busy}>
            <label>{tr("Motif", "Category")}
              <select value={category} disabled={busy} onChange={(event) => setCategory(event.target.value)}>
                <option value="bug">{tr("Problème ou dysfonctionnement", "Problem or malfunction")}</option>
                <option value="domain">{tr("Domaine / DNS", "Domain / DNS")}</option>
                <option value="publication">{tr("Publication", "Publishing")}</option>
                <option value="billing">{tr("Facturation", "Billing")}</option>
                <option value="ai">{tr("Création IA", "AI creation")}</option>
                <option value="data">{tr("Données", "Data")}</option>
                <option value="other">{tr("Autre", "Other")}</option>
              </select>
            </label>
            <label>{tr("Sujet", "Subject")}
              <input required minLength={3} maxLength={160} disabled={busy} value={subject} onChange={(event) => setSubject(event.target.value)} />
            </label>
            <label className="feedback-message">{tr("Décrivez ce que vous essayiez de faire", "Describe what you were trying to do")}
              <textarea required minLength={10} rows={5} maxLength={4000} disabled={busy} value={message} onChange={(event) => setMessage(event.target.value)} />
            </label>
            <button className="button primary" disabled={busy || subject.trim().length < 3 || message.trim().length < 10}>
              {busy ? tr("Envoi…", "Sending…") : tr("Envoyer ma demande", "Send my request")}
            </button>
          </form>
        </section>
      ) : null}
      {notice ? <p className="plans-note" role="status">{notice}</p> : null}

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
            <div className="actions">
              <button
                className="button secondary"
                onClick={() => void diagnose()}
                disabled={diagnosing || repairing}
              >
                {diagnosing
                  ? tr("Diagnostic en cours…", "Running diagnosis…")
                  : tr("Diagnostiquer mon site", "Diagnose my website")}
              </button>
              {health.repairActions?.length ? (
                <button
                  className="button primary"
                  onClick={() => void repair()}
                  disabled={repairing || diagnosing}
                >
                  {repairing
                    ? tr("Correction automatique…", "Repairing automatically…")
                    : tr("Corriger automatiquement", "Repair automatically")}
                </button>
              ) : null}
            </div>
            {healthNotice ? <p role="status">{healthNotice}</p> : null}
          </section>

          {guidance.length ? (
            <section className="panel" aria-labelledby="support-context-title">
              <p className="eyebrow">{tr("Aide contextuelle", "Contextual help")}</p>
              <h2 id="support-context-title">{tr("Que faire maintenant ?", "What should I do now?")}</h2>
              <p>{tr(
                "Ces explications utilisent uniquement les résultats du diagnostic ci-dessus. Aucun contenu de votre site ou de votre demande n’est envoyé à une IA.",
                "These explanations use only the diagnostic results above. No website or request content is sent to an AI."
              )}</p>
              <div className="support-guidance-grid">
                {guidance.map((item) => (
                  <article className="support-guidance-card" key={item.key}>
                    <h3>{item.title}</h3>
                    <p><strong>{tr("Pourquoi ?", "Why?")}</strong> {item.why}</p>
                    <p><strong>{tr("Action", "Action")}</strong> {item.action}</p>
                    {item.href && item.cta ? <Link className="button secondary" href={item.href}>{item.cta}</Link> : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="panel" aria-labelledby="support-knowledge-title">
            <p className="eyebrow">{tr("Base de connaissances", "Knowledge base")}</p>
            <h2 id="support-knowledge-title">{tr("Résoudre les cas les plus fréquents", "Resolve the most common cases")}</h2>
            <p>{topic
              ? tr(
                  "Vous arrivez depuis un écran précis : ELTARA affiche d’abord les fiches directement liées à ce contexte.",
                  "You came from a specific screen: ELTARA shows the guides directly related to that context first."
                )
              : tr(
                  "Ces fiches décrivent les parcours ELTARA actuels et renvoient directement vers l’écran concerné.",
                  "These guides describe the current ELTARA flows and link directly to the relevant screen."
                )}</p>
            {topic ? <Link className="text-link" href="/support">{tr("Voir toute la base de connaissances", "View the full knowledge base")} →</Link> : null}
            <div className="support-knowledge-grid">
              {knowledgeArticles.map((article) => (
                <article className="support-knowledge-card" key={article.key}>
                  <span className="support-knowledge-category">{article.category}</span>
                  <h3>{article.title}</h3>
                  <p>{article.summary}</p>
                  <ol>
                    {article.steps.map((step) => <li key={step}>{step}</li>)}
                  </ol>
                  <Link className="text-link" href={article.href}>{tr("Ouvrir le parcours", "Open the flow")} →</Link>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2>{tr("Mes demandes", "My requests")}</h2>
            {payload?.tickets.length ? (
              <ul>
                {payload.tickets.map((ticket) => (
                  <li key={ticket.id}>
                    <strong>{ticket.subject}</strong> · {ticket.status} · {new Date(ticket.created_at).toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR")}
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
