"use client";

import { FormEvent, useRef, useState } from "react";\nimport { recordPublicAnalytics } from "./PublicAnalyticsTracker";

type Props = {
  siteId: string;
  pagePath: string;
  email: string;
  english?: boolean;
  privacyHref?: string;
};

export default function PublicContactForm({ siteId, pagePath, email, english = false, privacyHref }: Props) {
  const [sending, setSending] = useState(false);\n  const started = useRef(false);
  const [status, setStatus] = useState<{ state: "idle" | "success" | "error"; message: string }>({ state: "idle", message: "" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const form = new FormData(event.currentTarget);
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
    try {
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
        const message = copy[code] || ["Envoi impossible pour le moment. Vous pouvez utiliser l’e-mail direct ci-dessous.", "Unable to send right now. You can use the direct email link below."];
        throw new Error(english ? message[1] : message[0]);
      }
      recordPublicAnalytics(siteId, "form_submit", pagePath, "contact");\n      event.currentTarget.reset();
      setStatus({
        state: "success",
        message: english ? "Message sent. Thank you — the site publisher can now reply to you." : "Message envoyé. Merci — l’éditeur du site peut maintenant vous répondre."
      });
    } catch (error) {
      setStatus({
        state: "error",
        message: error instanceof Error ? error.message : (english ? "Unable to send the message." : "Impossible d’envoyer le message.")
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <form\n      className="public-contact-form"\n      onSubmit={submit}\n      onFocusCapture={() => {\n        if (started.current) return;\n        started.current = true;\n        recordPublicAnalytics(siteId, "form_start", pagePath, "contact");\n      }}\n    >
      <label>
        {english ? "Name" : "Nom"}
        <input name="name" required maxLength={100} autoComplete="name" />
      </label>
      <label>
        {english ? "Email" : "E-mail"}
        <input name="email" type="email" required maxLength={254} autoComplete="email" />
      </label>
      <label className="public-contact-message">
        {english ? "Subject (optional)" : "Objet (facultatif)"}
        <input name="subject" maxLength={160} />
      </label>
      <label className="public-contact-message">
        {english ? "Message" : "Message"}
        <textarea name="message" required minLength={10} maxLength={4000} />
      </label>
      <label className="public-contact-honeypot" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="public-contact-consent">
        <input name="consent" type="checkbox" required />
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
