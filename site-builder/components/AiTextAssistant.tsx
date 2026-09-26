"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";
import type { SiteLanguage } from "../lib/site-config";

export type AiWritableField =
  | "heroTagline"
  | "heroTitle"
  | "heroSubtitle"
  | "aboutHeading"
  | "aboutText"
  | "bookingLabel";

type Props = {
  field: AiWritableField;
  label: string;
  value: string;
  language: SiteLanguage;
  affiliation: "mwr" | "independent";
  firstName: string;
  brandName: string;
  siteContext?: {
    heroTagline?: string;
    heroTitle?: string;
    heroSubtitle?: string;
    aboutHeading?: string;
    aboutText?: string;
    guidedTraveler?: string;
    guidedDiscovery?: string;
    guidedBenefit?: string;
    guidedAudience?: string;
  };
  onApply: (text: string) => void;
  placeholder: string;
};

export default function AiTextAssistant({
  field,
  label,
  value,
  language,
  affiliation,
  firstName,
  brandName,
  siteContext,
  onApply,
  placeholder
}: Props) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [suggestion, setSuggestion] = useState("");

  const generate = async (quickInstruction?: string) => {
    const request = (quickInstruction || instruction).trim();
    if (!request) {
      setState("error");
      setMessage("Décrivez en quelques mots ce que vous souhaitez obtenir.");
      return;
    }

    setState("loading");
    setMessage("");
    setSuggestion("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { data } = supabase
        ? await supabase.auth.getSession()
        : { data: { session: null } };

      const response = await fetch("/api/ai/write", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(data.session?.access_token
            ? { Authorization: `Bearer ${data.session.access_token}` }
            : {})
        },
        body: JSON.stringify({
          field,
          instruction: request,
          currentText: value,
          context: {
            language,
            affiliation,
            firstName,
            brandName,
            siteContext
          }
        })
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result?.error ||
          (response.status === 503
            ? "L'assistant IA n'est pas encore activé sur cet environnement."
            : "Impossible de générer le texte pour le moment.")
        );
      }

      if (!result?.text || typeof result.text !== "string") {
        throw new Error("La réponse de l'IA est vide. Réessayez avec une demande un peu plus précise.");
      }

      setSuggestion(result.text.trim());
      setState("done");
      setMessage("Proposition prête. Relisez-la avant de remplacer votre texte.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Une erreur est survenue.");
    }
  };

  const quickPrompts = language === "en"
    ? ["Improve", "More natural", "Warmer", "More professional", "Shorter", "New suggestion"]
    : ["Améliorer", "Plus naturel", "Plus chaleureux", "Plus professionnel", "Plus court", "Nouvelle proposition"];

  const ui = language === "en"
    ? {
        trigger: "Write with AI",
        optional: "Optional · you stay in control of the final text",
        question: `What would you like for ${label}?`,
        suggestions: "Suggestions",
        proposal: "AI suggestion",
        use: "Use this text",
        regenerate: "Regenerate",
        generate: "Generate a suggestion",
        generateAnother: "Generate another suggestion",
        writing: "Writing…",
        close: "Close",
        current: "Your current text is used as context. Nothing is replaced until you approve the suggestion."
      }
    : {
        trigger: "Écrire avec l'IA",
        optional: "Facultatif · vous gardez le contrôle du texte final",
        question: `Que voulez-vous pour ${label} ?`,
        suggestions: "Suggestions",
        proposal: "Proposition de l'IA",
        use: "Utiliser ce texte",
        regenerate: "Regénérer",
        generate: "Générer une proposition",
        generateAnother: "Générer une autre proposition",
        writing: "Rédaction…",
        close: "Fermer",
        current: "Votre texte actuel sert de contexte. Rien n'est remplacé avant votre validation."
      };

  return (
    <div className={"ai-field-assistant " + (open ? "open" : "")}>
      <button
        type="button"
        className="ai-field-trigger"
        onClick={() => {
          setOpen((value) => !value);
          setState("idle");
          setMessage("");
        }}
        aria-expanded={open}
      >
        <span className="ai-field-spark">✦</span>
        <span>
          <b>{ui.trigger}</b>
          <small>{ui.optional}</small>
        </span>
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>

      {open ? (
        <div className="ai-field-panel">
          <label>
            <span>{ui.question}</span>
            <textarea
              rows={3}
              value={instruction}
              onChange={(event) => {
                setInstruction(event.target.value);
                if (state === "error") {
                  setState("idle");
                  setMessage("");
                }
              }}
              placeholder={placeholder}
              maxLength={800}
            />
          </label>

          <div className="ai-quick-prompts" aria-label={ui.suggestions}>
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={state === "loading" || (!value.trim() && prompt !== "Nouvelle proposition" && prompt !== "New suggestion")}
                onClick={() => { setInstruction(prompt); void generate(prompt); }}
              >
                {prompt}
              </button>
            ))}
          </div>

          {suggestion ? (
            <div className="ai-current-note" role="status" aria-live="polite">
              <b>{ui.proposal}</b>
              <p>{suggestion}</p>
              <div className="ai-field-actions">
                <button type="button" className="button primary premium-button" onClick={() => {
                  onApply(suggestion);
                  setSuggestion("");
                  setState("done");
                  setMessage("✓ Proposition insérée. Vous pouvez encore la modifier librement.");
                }}>{ui.use}</button>
                <button type="button" className="button secondary" onClick={() => void generate("Nouvelle proposition")}>{ui.regenerate}</button>
              </div>
            </div>
          ) : null}

          {value.trim() ? (
            <p className="ai-current-note">
              {ui.current}
            </p>
          ) : null}

          <div className="ai-field-actions">
            <button
              type="button"
              className="button primary premium-button"
              disabled={state === "loading" || !instruction.trim()}
              onClick={() => void generate()}
            >
              {state === "loading" ? ui.writing : suggestion ? ui.generateAnother : ui.generate}
              {state !== "loading" ? <span aria-hidden="true">→</span> : null}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setOpen(false)}
              disabled={state === "loading"}
            >
              {ui.close}
            </button>
          </div>

          {message ? (
            <p
              className={"ai-field-message " + state}
              role={state === "error" ? "alert" : "status"}
            >
              {message}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
