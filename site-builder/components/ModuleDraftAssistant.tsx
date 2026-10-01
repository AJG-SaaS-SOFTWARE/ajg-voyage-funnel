"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";
import type { SiteLanguage } from "../lib/site-config";
import { useProductLocale } from "../lib/product-i18n";

export type AssistedModuleType = "faq" | "benefits" | "figures";

type ModuleDraft =
  | { title: string; items: { question: string; answer: string }[] }
  | { title: string; items: { title: string; text: string }[] }
  | { title: string; items: { value: string; label: string }[] };

type Props = {
  moduleType: AssistedModuleType;
  brief: string;
  language: SiteLanguage;
  affiliation: "mwr" | "independent";
  firstName: string;
  brandName: string;
  currentValue: unknown;
  siteContext?: Record<string, string | undefined>;
  onApply: (draft: ModuleDraft) => void;
};

const labelsFr: Record<AssistedModuleType, { title: string; help: string; instruction: string }> = {
  faq: {
    title: "Préparer la FAQ avec l’IA",
    help: "AJG propose des questions et réponses à partir de votre activité et de l’objectif du site. Vous gardez la main sur chaque ligne.",
    instruction: "Propose une FAQ utile, naturelle et rassurante pour un visiteur qui découvre cette activité. Évite les questions artificielles ou trop commerciales."
  },
  benefits: {
    title: "Préparer les avantages avec l’IA",
    help: "AJG transforme votre description en avantages concrets, sans inventer de promesses, chiffres ou résultats.",
    instruction: "Propose des avantages concrets et crédibles pour le visiteur à partir uniquement des informations fournies."
  },
  figures: {
    title: "Trouver des idées de chiffres clés",
    help: "AJG propose uniquement ce qu’il pourrait être pertinent de mesurer. Les valeurs restent vides tant que vous ne les avez pas renseignées.",
    instruction: "Propose des catégories de chiffres clés pertinentes à renseigner, mais ne fournis aucune valeur numérique ni statistique."
  }

};

const labelsEn: Record<AssistedModuleType, { title: string; help: string; instruction: string }> = {
  faq: {
    title: "Prepare the FAQ with AI",
    help: "AJG suggests useful questions and answers from your activity and website goal. You stay in control of every line.",
    instruction: "Create a useful, natural and reassuring FAQ for a visitor discovering this activity. Avoid artificial or overly sales-driven questions."
  },
  benefits: {
    title: "Prepare benefits with AI",
    help: "AJG turns your description into concrete benefits without inventing promises, figures or outcomes.",
    instruction: "Suggest concrete and credible visitor benefits using only the information provided."
  },
  figures: {
    title: "Find key metric ideas",
    help: "AJG only suggests what may be worth measuring. Values remain empty until you provide them.",
    instruction: "Suggest relevant categories of key metrics to fill in, but provide no numerical values or statistics."
  }
};

export default function ModuleDraftAssistant({
  moduleType,
  brief,
  language,
  affiliation,
  firstName,
  brandName,
  currentValue,
  siteContext,
  onApply
}: Props) {
  const { locale: uiLocale, tr } = useProductLocale();
  const [open, setOpen] = useState(false);
  const [precision, setPrecision] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<ModuleDraft | null>(null);
  const copy = (uiLocale === "en" ? labelsEn : labelsFr)[moduleType];

  const generate = async () => {
    if (!brief.trim()) {
      setState("error");
      setMessage(tr("Décrivez d’abord votre activité, votre business ou l’objectif du site dans le champ situé au-dessus des rubriques.", "First describe your activity, business or website goal in the field above the sections."));
      return;
    }

    setState("loading");
    setMessage("");
    setDraft(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data } = supabase
        ? await supabase.auth.getSession()
        : { data: { session: null } };

      const response = await fetch("/api/ai/write", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AJG-Locale": uiLocale,
          ...(data.session?.access_token
            ? { Authorization: `Bearer ${data.session.access_token}` }
            : {})
        },
        body: JSON.stringify({
          field: "moduleDraft",
          instruction: [copy.instruction, precision.trim()].filter(Boolean).join(" "),
          currentText: JSON.stringify(currentValue),
          context: {
            language,
            affiliation,
            firstName,
            brandName,
            moduleType,
            moduleBrief: brief,
            siteContext
          }
        })
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result?.error || tr("Impossible de préparer cette rubrique pour le moment.", "This section could not be prepared right now."));
      }

      if (!result?.draft || typeof result.draft !== "object") {
        throw new Error(tr("La proposition reçue n’est pas exploitable. Réessayez.", "The received proposal cannot be used. Try again."));
      }

      setDraft(result.draft as ModuleDraft);
      setState("done");
      setMessage(tr("Proposition prête. Vérifiez-la avant de l’insérer dans la rubrique.", "Proposal ready. Review it before inserting it into the section."));
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : tr(
              "La rubrique n’a pas pu être préparée. Vérifiez votre connexion puis réessayez ; vous pouvez aussi remplir la rubrique manuellement sans perdre vos données.",
              "The section could not be prepared. Check your connection and try again; you can also fill the section manually without losing your data."
            )
      );
    }
  };

  const preview = () => {
    if (!draft) return null;
    const items = Array.isArray(draft.items) ? draft.items : [];
    return (
      <div className="module-ai-preview">
        <b>{draft.title}</b>
        {moduleType === "faq" ? items.map((item: any, index) => (
          <div className="module-ai-preview-item" key={index}>
            <strong>{item.question}</strong>
            <p>{item.answer}</p>
          </div>
        )) : moduleType === "benefits" ? items.map((item: any, index) => (
          <div className="module-ai-preview-item" key={index}>
            <strong>{item.title}</strong>
            <p>{item.text}</p>
          </div>
        )) : items.map((item: any, index) => (
          <div className="module-ai-preview-item compact" key={index}>
            <strong>{item.label}</strong>
            <p>{tr("Valeur à renseigner par vous", "Value to be provided by you")}</p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={"module-ai-assistant " + (open ? "open" : "")}>
      <button
        type="button"
        className="module-ai-trigger"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
          setMessage("");
          if (state === "error") setState("idle");
        }}
      >
        <span className="ai-field-spark">✦</span>
        <span><b>{copy.title}</b><small>{copy.help}</small></span>
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>

      {open ? (
        <div className="module-ai-panel">
          <label>
            <span>{tr("Une précision pour cette rubrique ?", "Anything specific for this section?")} <em>{tr("facultatif", "optional")}</em></span>
            <textarea
              rows={2}
              maxLength={500}
              value={precision}
              onChange={(event) => setPrecision(event.target.value)}
              placeholder={moduleType === "faq"
                ? tr("Ex. Je veux surtout répondre aux questions des personnes qui découvrent mon activité.", "e.g. I mainly want to answer questions from people discovering my activity.")
                : moduleType === "benefits"
                  ? tr("Ex. Mettre en avant la simplicité et l’accompagnement.", "e.g. Emphasize simplicity and support.")
                  : tr("Ex. Je veux montrer mon expérience et mon activité sans chiffres commerciaux.", "e.g. I want to show my experience and activity without sales figures.")}
            />
          </label>

          {preview()}

          <div className="module-ai-actions">
            <button type="button" className="button secondary" disabled={state === "loading"} onClick={() => void generate()}>
              {state === "loading" ? tr("Préparation…", "Preparing…") : draft ? tr("Nouvelle proposition", "New proposal") : tr("Générer une proposition", "Generate proposal")}
            </button>
            {draft ? (
              <button
                type="button"
                className="button primary"
                onClick={() => {
                  onApply(draft);
                  setMessage(tr("✓ Proposition insérée. Vous pouvez maintenant modifier librement chaque champ.", "✓ Proposal inserted. You can now freely edit every field."));
                }}
              >
                {tr("Utiliser ces propositions", "Use these proposals")}
              </button>
            ) : null}
          </div>

          {message ? <p className={"module-ai-message " + state} role="status" aria-live="polite">{message}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
