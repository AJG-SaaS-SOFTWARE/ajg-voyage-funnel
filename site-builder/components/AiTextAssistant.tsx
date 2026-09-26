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
      setMessage(language === "en"
        ? "Describe in a few words what you would like to obtain."
        : "Décrivez en quelques mots ce que vous souhaitez obtenir.");
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
            ? (language === "en"
              ? "The AI assistant is not enabled in this environment yet."
              : "L'assistant IA n'est pas encore activé sur cet environnement.")
            : (language === "en"
              ? "The text could not be generated right now."
              : "Impossible de générer le texte pour le moment."))
        );
      }

      if (!result?.text || typeof result.text !== "string") {
        throw new Error(language === "en"
          ? "The AI response is empty. Try again with a slightly more specific request."
          : "La réponse de l'IA est vide. Réessayez avec une demande un peu plus précise.");
      }

      setSuggestion(result.text.trim());
      setState("done");
      setMessage(language === "en"
        ? "Suggestion ready. Review it before replacing your text."
        : "Proposition prête. Relisez-la avant de remplacer votre texte.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error
        ? error.message
        : (language === "en" ? "An error occurred." : "Une erreur est survenue."));
    }
  };

  const quickPrompts = language === "en"
    ? [
        { label: "Improve", instruction: "Improve the current text for clarity, flow and impact while preserving every factual claim and the intended tone.", requiresValue: true },
        { label: "More natural", instruction: "Rewrite the current text so it sounds more natural, fluent and human, without adding new facts.", requiresValue: true },
        { label: "Warmer", instruction: "Rewrite the current text with a warmer, more welcoming tone while staying credible and avoiding hype.", requiresValue: true },
        { label: "More professional", instruction: "Rewrite the current text in a polished, professional and credible tone without making it stiff or corporate.", requiresValue: true },
        { label: "Shorter", instruction: "Shorten the current text substantially while keeping the essential message, facts and natural tone.", requiresValue: true },
        { label: "New suggestion", instruction: "Write a genuinely different new version for this field using the available site context and without inventing facts.", requiresValue: false }
      ]
    : [
        { label: "Améliorer", instruction: "Améliore le texte actuel pour gagner en clarté, fluidité et impact, sans modifier les faits ni le ton recherché.", requiresValue: true },
        { label: "Plus naturel", instruction: "Réécris le texte actuel pour qu'il paraisse plus naturel, fluide et humain, sans ajouter de nouveaux faits.", requiresValue: true },
        { label: "Plus chaleureux", instruction: "Réécris le texte actuel avec un ton plus chaleureux et accueillant, tout en restant crédible et sans exagération marketing.", requiresValue: true },
        { label: "Plus professionnel", instruction: "Réécris le texte actuel avec un ton soigné, professionnel et crédible, sans le rendre froid ou trop institutionnel.", requiresValue: true },
        { label: "Plus court", instruction: "Raccourcis nettement le texte actuel en conservant le message essentiel, les faits et un ton naturel.", requiresValue: true },
        { label: "Nouvelle proposition", instruction: "Rédige une nouvelle version réellement différente pour ce champ en utilisant le contexte disponible du site, sans inventer de faits.", requiresValue: false }
      ];

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
                key={prompt.label}
                type="button"
                disabled={state === "loading" || (prompt.requiresValue && !value.trim())}
                onClick={() => {
                  setInstruction(prompt.label);
                  void generate(prompt.instruction);
                }}
              >
                {prompt.label}
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
                  setMessage(language === "en"
                    ? "✓ Suggestion inserted. You can still edit it freely."
                    : "✓ Proposition insérée. Vous pouvez encore la modifier librement.");
                }}>{ui.use}</button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => void generate(language === "en"
                    ? "Write another genuinely different version for this field using the same factual context."
                    : "Rédige une autre version réellement différente pour ce champ en conservant le même contexte factuel.")}
                >{ui.regenerate}</button>
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
