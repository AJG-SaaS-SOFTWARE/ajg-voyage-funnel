"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { submitFeedback, type FeedbackCategory } from "../../lib/product-analytics";
import { useProductLocale } from "../../lib/product-i18n";
import { getMySite } from "../../lib/supabase-site-repository";
import { LanguageSwitch } from "../../components/LanguageSwitch";

export default function FeedbackPage() {
  const { tr } = useProductLocale();
  const [category, setCategory] = useState<FeedbackCategory>("usability");
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [siteId, setSiteId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getMySite()
      .then((site) => {
        if (!cancelled) setSiteId(site?.id || null);
      })
      .catch(() => {
        if (!cancelled) setSiteId(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      await submitFeedback({ category, rating, message, siteId });
      setMessage("");
      setStatus(
        tr(
          "Merci. Votre retour est enregistré et rattaché au site concerné pour faciliter le diagnostic.",
          "Thank you. Your feedback has been recorded and linked to the relevant website to make diagnosis easier."
        )
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : tr("Envoi impossible.", "Unable to send feedback.")
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="plans-page">
      <section className="plans-hero">
        <div className="builder-language-row">
          <p className="eyebrow">ELTARA Beta</p>
          <LanguageSwitch compact />
        </div>
        <h1>{tr("Votre retour améliore le Builder", "Your feedback improves the Builder")}</h1>
        <p>
          {tr(
            "Décrivez ce qui vous bloque, ce qui manque ou ce qui pourrait être plus simple. Aucun historique de navigation, donnée publicitaire ou contenu du site n’est ajouté automatiquement à votre message.",
            "Tell us what blocks you, what is missing or what could be simpler. No browsing history, advertising data or website content is automatically added to your message."
          )}
        </p>
        <Link className="button secondary" href="/builder">
          ← {tr("Retour au builder", "Back to Builder")}
        </Link>
      </section>

      <section className="panel beta-feedback-guide">
        <p className="eyebrow">{tr("Pour un retour utile", "For useful feedback")}</p>
        <h2>{tr("Dites-nous surtout où vous avez hésité", "Tell us where you hesitated")}</h2>
        <p>
          {tr(
            "Indiquez ce que vous cherchiez à faire, ce que vous attendiez, puis ce qui vous a surpris ou ralenti. Le site est relié au retour uniquement par son identifiant technique.",
            "Tell us what you were trying to do, what you expected, and what surprised or slowed you down. The website is linked to the feedback only through its technical identifier."
          )}
        </p>
      </section>

      <form className="feedback-form" onSubmit={send}>
        <label>
          {tr("Type de retour", "Feedback type")}
          <select value={category} onChange={(event) => setCategory(event.target.value as FeedbackCategory)}>
            <option value="usability">{tr("Facilité d’utilisation", "Ease of use")}</option>
            <option value="quality">{tr("Qualité du résultat", "Result quality")}</option>
            <option value="bug">Bug</option>
            <option value="idea">{tr("Idée", "Idea")}</option>
            <option value="other">{tr("Autre", "Other")}</option>
          </select>
        </label>

        <label>
          {tr("Note globale", "Overall rating")}
          <select value={rating} onChange={(event) => setRating(Number(event.target.value))}>
            {[5, 4, 3, 2, 1].map((number) => (
              <option key={number} value={number}>{number}/5</option>
            ))}
          </select>
        </label>

        <label className="feedback-message">
          {tr("Votre retour", "Your feedback")}
          <textarea
            rows={7}
            maxLength={2000}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={tr(
              "Exemple : je voulais publier mon site, je pensais que le bouton serait ici, puis j’ai dû chercher…",
              "Example: I wanted to publish my website, expected the button to be here, then had to search…"
            )}
          />
        </label>

        <button className="button primary" disabled={busy || message.trim().length < 3}>
          {busy ? tr("Envoi…", "Sending…") : tr("Envoyer mon retour", "Send feedback")}
        </button>
      </form>

      {status ? <p className="plans-note" role="status">{status}</p> : null}
    </main>
  );
}
