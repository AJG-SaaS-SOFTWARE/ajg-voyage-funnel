"use client";

import { FormEvent, useRef, useState } from "react";
import { recordPublicAnalytics } from "./PublicAnalyticsTracker";

type Props = {
  siteId: string;
  pagePath: string;
  email: string;
  english?: boolean;
  privacyHref?: string;
};

export default function PublicContactForm({ siteId, pagePath, email, english = false, privacyHref }: Props) {
  const [sending, setSending] = useState(false);
  const submitting = useRef(false);
  const started = useRef(false);
  const [status, setStatus] = useState<{ state: "idle" | "success" | "error"; message: string }>({ state: "idle", message: "" });
  const unconfirmedMessage = english
    ? "We could not confirm the result. Your entries have been kept. Check before sending again."
    : "Le résultat n’a pas pu être confirmé. Votre saisie est conservée. Vérifiez avant de renvoyer le message.";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    // React clears currentTarget after dispatch, before the response arrives.
    const formElement = event.currentTarget;
    submitting.current = true;
    try {
      const form = new FormData(formElement);
      const payload = {
        siteId,
        name: String(form.get("name") || "").trim(),
        email: String(form.get("email") || "").trim(),
        subject: String(form.get("subject") || "").trim(),
        message: String(form.get("message") || "").trim(),
        consent: form.get("consent") === "on",
        website: String(form.get("website") || "").trim()
      };
      setSending(true);
      setStatus({ state: "idle", message: "" });
      const response = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const code = body?.error || "unavailable";
        const copy: Record<string, [string, string]> = {
          rate_limited: ["Trop de messages ont été envoyés récemment. Réessayez dans quelques minutes.", "Too many messages were sent recently. Please try again in a few minutes."],
          consent_required: ["Votre accord est nécessaire pour transmettre ce message.", "Your consent is required to send this message."],
          invalid_contact_message: ["Vérifiez les champs du formulaire puis réessayez.", "Please check the form fields and try again."],
          site_not_available: ["Ce formulaire n’est pas disponible pour le moment.", "This form is not available right now."],
          contact_disabled: ["Ce formulaire n’est pas activé.", "This form is not enabled."]
        };
        const message = typeof code === "string" && Object.hasOwn(copy, code)
          ? copy[code][english ? 1 : 0] : unconfirmedMessage;
        setStatus({ state: "error", message });
        return;
      }
      // Suppression intentionally keeps the existing honeypot camouflage;
      // it is not a stored-message receipt and must not count as one.
      const suppressed = response.status === 200 && body?.ok === true && body?.notification === "suppressed";
      const recorded = response.status === 201 && body?.ok === true &&
        typeof body.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id) &&
        ["sent", "stored"].includes(body.notification);
      if (!suppressed && !recorded) throw new Error("contact_receipt_unconfirmed");
      setStatus({
        state: "success",
        message: suppressed
          ? (english ? "Thank you. Your request has been processed." : "Merci. Votre demande a été prise en compte.")
          : (english ? "Message recorded. Thank you — the site publisher can now reply to you." : "Message enregistré. Merci — l’éditeur du site peut maintenant vous répondre.")
      });
      // Ancillary UI/analytics failures cannot revoke the accepted receipt.
      try { formElement.reset(); } catch { /* Keep the confirmed receipt. */ }
      if (recorded) {
        try { recordPublicAnalytics(siteId, "form_submit", pagePath, "contact"); } catch { /* Best effort only. */ }
      }
    } catch {
      setStatus({
        state: "error",
        message: unconfirmedMessage
      });
    } finally {
      submitting.current = false;
      setSending(false);
    }
  }

  return (
    <form
      className="public-contact-form"
      aria-busy={sending}
      onSubmit={submit}
      onFocusCapture={() => {
        if (started.current) return;
        started.current = true;
        try { recordPublicAnalytics(siteId, "form_start", pagePath, "contact"); } catch { /* Best effort only. */ }
      }}
    >
      <label>
        {english ? "Name" : "Nom"}
        <input name="name" required maxLength={100} autoComplete="name" disabled={sending} />
      </label>
      <label>
        {english ? "Email" : "E-mail"}
        <input name="email" type="email" required maxLength={254} autoComplete="email" disabled={sending} />
      </label>
      <label className="public-contact-message">
        {english ? "Subject (optional)" : "Objet (facultatif)"}
        <input name="subject" maxLength={160} disabled={sending} />
      </label>
      <label className="public-contact-message">
        {english ? "Message" : "Message"}
        <textarea name="message" required minLength={10} maxLength={4000} disabled={sending} />
      </label>
      <label className="public-contact-honeypot" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" disabled={sending} />
      </label>
      <label className="public-contact-consent">
        <input name="consent" type="checkbox" required disabled={sending} />
        <span>
          {english
            ? "I agree that the information entered above is used to send my request to the site publisher and allow a reply."
            : "J’accepte que les informations saisies ci-dessus soient utilisées pour transmettre ma demande à l’éditeur du site et lui permettre de me répondre."}
          {privacyHref ? <> {" "}<a href={privacyHref}>{english ? "Privacy policy" : "Politique de confidentialité"}</a>.</> : null}
        </span>
      </label>
      <div className="public-contact-actions">
        <button className="button primary" type="submit" disabled={sending}>
          {sending ? (english ? "Sending…" : "Envoi…") : (english ? "Send message" : "Envoyer le message")}
        </button>
        <a className="public-contact-direct" data-eltara-analytics="contact_email" href={`mailto:${email}`}>{english ? "Or send an email directly" : "Ou envoyer un e-mail directement"}</a>
      </div>
      {status.state !== "idle" ? (
        <p className="public-contact-status" role="status" data-state={status.state}>{status.message}</p>
      ) : null}
    </form>
  );
}
