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
  onApply,
  placeholder
}: Props) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const generate = async () => {
    const request = instruction.trim();
    if (!request) {
      setState("error");
      setMessage("Décrivez en quelques mots ce que vous souhaitez obtenir.");
      return;
    }

    setState("loading");
    setMessage("");

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
            brandName
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

      onApply(result.text.trim());
      setState("done");
      setMessage("✓ Proposition ajoutée dans le champ. Vous pouvez la modifier librement.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Une erreur est survenue.");
    }
  };

  const quickPrompts = [
    "Rends le texte plus chaleureux et naturel",
    "Raccourcis et simplifie le texte",
    "Rends le texte plus professionnel sans être commercial"
  ];

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
          <b>Écrire avec l'IA</b>
          <small>Facultatif · vous pourrez modifier le résultat</small>
        </span>
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>

      {open ? (
        <div className="ai-field-panel">
          <label>
            <span>Que voulez-vous pour {label} ?</span>
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

          <div className="ai-quick-prompts" aria-label="Suggestions">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => setInstruction(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>

          {value.trim() ? (
            <p className="ai-current-note">
              Le texte déjà présent servira de contexte. La nouvelle proposition le remplacera dans le champ,
              mais vous pourrez encore la modifier.
            </p>
          ) : null}

          <div className="ai-field-actions">
            <button
              type="button"
              className="button primary premium-button"
              disabled={state === "loading" || !instruction.trim()}
              onClick={generate}
            >
              {state === "loading" ? "Rédaction…" : "Générer et insérer"}
              {state !== "loading" ? <span aria-hidden="true">→</span> : null}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setOpen(false)}
              disabled={state === "loading"}
            >
              Fermer
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
