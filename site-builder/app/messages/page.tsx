"use client";

import { useEffect, useMemo, useState } from "react";
import { AccountShell } from "../../components/AccountShell";
import { useProductLocale } from "../../lib/product-i18n";
import {
  deleteMyContactMessage,
  getMyContactMessages,
  getMySites,
  type ContactMessage,
  type RemoteSite
} from "../../lib/supabase-site-repository";

export default function MessagesPage() {
  const { locale, tr } = useProductLocale();
  const [sites, setSites] = useState<RemoteSite[]>([]);
  const [siteId, setSiteId] = useState("");
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    void getMySites()
      .then((items) => {
        if (cancelled) return;
        setSites(items);
        setSiteId((current) => current || items[0]?.id || "");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!siteId) {
      setMessages([]);
      if (sites.length === 0) setState("ready");
      return;
    }
    let cancelled = false;
    setState("loading");
    setNotice("");
    void getMyContactMessages(siteId)
      .then((items) => {
        if (cancelled) return;
        setMessages(items);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => { cancelled = true; };
  }, [siteId, sites.length]);

  const selectedSite = useMemo(() => sites.find((site) => site.id === siteId) || null, [sites, siteId]);

  async function remove(messageId: string) {
    const confirmed = window.confirm(tr(
      "Supprimer définitivement ce message ?",
      "Permanently delete this message?"
    ));
    if (!confirmed) return;
    setNotice("");
    try {
      await deleteMyContactMessage(messageId);
      setMessages((current) => current.filter((item) => item.id !== messageId));
      setNotice(tr("Message supprimé.", "Message deleted."));
    } catch {
      setNotice(tr("Suppression impossible pour le moment.", "Unable to delete the message right now."));
    }
  }

  return (
    <AccountShell
      active="messages"
      eyebrow={tr("Contacts", "Contacts")}
      title={tr("Messages reçus", "Received messages")}
      description={tr(
        "Retrouvez ici les demandes envoyées depuis le formulaire de contact de vos sites. L’e-mail reste disponible comme canal complémentaire.",
        "Find requests sent from your websites’ contact forms here. Email remains available as an additional channel."
      )}
    >
      <div className="contact-inbox-toolbar">
        <label>
          {tr("Site", "Website")}
          <select value={siteId} onChange={(event) => setSiteId(event.target.value)} disabled={!sites.length}>
            {sites.length ? sites.map((site) => (
              <option key={site.id} value={site.id}>{site.config.brandName || site.slug}</option>
            )) : <option value="">{tr("Aucun site", "No website")}</option>}
          </select>
        </label>
        <span className="contact-inbox-count">
          {messages.length} {tr(messages.length > 1 ? "messages" : "message", messages.length === 1 ? "message" : "messages")}
        </span>
      </div>

      {notice ? <p className="account-note" role="status">{notice}</p> : null}
      {state === "loading" ? <p className="account-note">{tr("Chargement des messages…", "Loading messages…")}</p> : null}
      {state === "error" ? <p className="account-note">{tr("Impossible de charger les messages. Réessayez dans quelques instants.", "Unable to load messages. Please try again shortly.")}</p> : null}

      {state === "ready" && selectedSite && messages.length === 0 ? (
        <div className="contact-message-empty">
          <b>{tr("Aucun message pour le moment", "No messages yet")}</b>
          <p>{tr("Les nouvelles demandes envoyées depuis le formulaire public apparaîtront ici.", "New requests sent from the public form will appear here.")}</p>
        </div>
      ) : null}

      {state === "ready" && messages.length ? (
        <div className="contact-inbox-list">
          {messages.map((message) => (
            <article className="contact-message-card" key={message.id}>
              <div className="contact-message-head">
                <div>
                  <h2>{message.subject || tr("Message sans objet", "Message with no subject")}</h2>
                  <p>{message.senderName} · {message.senderEmail}</p>
                </div>
                <time className="contact-message-date" dateTime={message.createdAt}>
                  {new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", {
                    dateStyle: "medium",
                    timeStyle: "short"
                  }).format(new Date(message.createdAt))}
                </time>
              </div>
              <p className="contact-message-body">{message.message}</p>
              <div className="contact-message-actions">
                <a className="button primary" href={`mailto:${message.senderEmail}?subject=${encodeURIComponent("Re: " + (message.subject || ""))}`}>
                  {tr("Répondre", "Reply")}
                </a>
                <button className="button secondary" type="button" onClick={() => void remove(message.id)}>
                  {tr("Supprimer", "Delete")}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </AccountShell>
  );
}
