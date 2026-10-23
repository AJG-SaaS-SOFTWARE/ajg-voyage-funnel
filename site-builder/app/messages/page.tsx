"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccountShell } from "../../components/AccountShell";
import { useProductLocale } from "../../lib/product-i18n";
import {
  deleteMyContactMessage,
  getMyContactMessages,
  getMySites,
  type ContactMessage,
  type RemoteSite
} from "../../lib/supabase-site-repository";

const MESSAGES_LOAD_TIMEOUT_MS = 15_000;

async function withMessagesLoadDeadline<T>(work: Promise<T>) {
  let timeoutId: number | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(
          () => reject(new Error("messages_load_timeout")),
          MESSAGES_LOAD_TIMEOUT_MS
        );
      })
    ]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}

export default function MessagesPage() {
  const { locale, tr } = useProductLocale();
  const [sites, setSites] = useState<RemoteSite[]>([]);
  const [siteId, setSiteId] = useState("");
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [notice, setNotice] = useState("");
  const loadSequence = useRef(0);

  const load = useCallback(async (selectedId?: string) => {
    const sequence = ++loadSequence.current;
    setState("loading");
    setNotice("");
    setMessages([]);
    if (selectedId) setSiteId(selectedId);
    try {
      const snapshot = await withMessagesLoadDeadline((async () => {
        const owned = await getMySites();
        const selected = owned.find((site) => site.id === selectedId) || owned[0] || null;
        const items = selected ? await getMyContactMessages(selected.id) : [];
        return { owned, selected, items };
      })());
      if (sequence !== loadSequence.current) return;
      setSites(snapshot.owned);
      setSiteId(snapshot.selected?.id || "");
      setMessages(snapshot.items);
      setState("ready");
    } catch {
      if (sequence !== loadSequence.current) return;
      setState("error");
      setNotice(tr(
        "Le chargement des messages n’a pas pu être confirmé. Aucun message n’est affiché. Vous pouvez réessayer.",
        "The message load could not be confirmed. No message is displayed. You can try again."
      ));
    }
  }, [tr]);

  useEffect(() => {
    void load();
    return () => { loadSequence.current += 1; };
  }, [load]);

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
          <select value={siteId} onChange={(event) => void load(event.target.value)} disabled={!sites.length || state === "loading"}>
            {sites.length ? sites.map((site) => (
              <option key={site.id} value={site.id}>{site.config.brandName || site.slug}</option>
            )) : <option value="">{tr("Aucun site", "No website")}</option>}
          </select>
        </label>
        <span className="contact-inbox-count">
          {messages.length} {tr(messages.length > 1 ? "messages" : "message", messages.length === 1 ? "message" : "messages")}
        </span>
      </div>

      {notice && state !== "error" ? <p className="account-note" role="status">{notice}</p> : null}
      {state === "loading" ? <p className="account-note">{tr("Chargement des messages…", "Loading messages…")}</p> : null}
      {state === "error" ? (
        <div className="account-note" role="alert">
          <p>{notice}</p>
          <button className="button secondary" type="button" onClick={() => void load(siteId || undefined)}>
            {tr("Réessayer", "Try again")}
          </button>
        </div>
      ) : null}

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
