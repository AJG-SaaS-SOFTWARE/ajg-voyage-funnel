"use client";

import type { BetaExperienceMode } from "../lib/beta-experience-mode";
import { useProductLocale } from "../lib/product-i18n";

export function BetaExperienceSwitch({
  mode,
  onChange,
  compact = false,
  inline = false
}: {
  mode: BetaExperienceMode;
  onChange: (mode: BetaExperienceMode) => void;
  compact?: boolean;
  inline?: boolean;
}) {
  const { tr } = useProductLocale();

  return (
    <section
      className={
        "beta-experience-switch " +
        (compact ? "is-compact " : "") +
        (inline ? "is-inline" : "")
      }
      aria-label={tr("Mode de test bêta", "Beta test mode")}
    >
      {!inline ? (
        <div className="beta-experience-copy">
          <span>{tr("ELTARA BÊTA", "ELTARA BETA")}</span>
          <div>
            <b>{tr("Tester l’expérience client", "Test the customer experience")}</b>
            {!compact ? (
              <small>{tr(
                "Parcours de test : RUN, puis Growth, puis Concepteur IA. Vos droits bêta restent actifs et aucun paiement n’est déclenché.",
                "Test RUN, then Growth, then AI Architect. Beta rights remain active and no payment is triggered."
              )}</small>
            ) : null}
          </div>
        </div>
      ) : (
        <span className="beta-experience-inline-label">{tr("Mode bêta", "Beta mode")}</span>
      )}

      <div className="beta-experience-options" role="group" aria-label={tr("Offre simulée", "Simulated plan")}>
        <button
          type="button"
          className={mode === "essential" ? "active" : ""}
          aria-pressed={mode === "essential"}
          onClick={() => onChange("essential")}
          title={tr("Tester le parcours RUN Essentiel", "Test the Essential RUN journey")}
        >
          <span>RUN</span>
          {!inline ? <b>{tr("Essentiel", "Essential")}</b> : null}
        </button>
        <button
          type="button"
          className={mode === "growth" ? "active" : ""}
          aria-pressed={mode === "growth"}
          onClick={() => onChange("growth")}
          title={tr("Tester le parcours RUN + GROW", "Test the RUN + GROW journey")}
        >
          <span>{inline ? "GROW" : "RUN + GROW"}</span>
          {!inline ? <b>Growth</b> : null}
        </button>
        <button
          type="button"
          className={mode === "architect" ? "active" : ""}
          aria-pressed={mode === "architect"}
          onClick={() => onChange("architect")}
          title={tr("Tester la Création IA complète", "Try full AI creation")}
        >
          <span>BUILD</span>
          {!inline ? <b>{tr("Concepteur IA", "AI Architect")}</b> : null}
        </button>
      </div>
      {!inline && !compact ? (
        <p className="beta-experience-guidance">{mode === "essential"
          ? tr("Étape 1/3 : créez votre site avec les fonctions Essentiel.", "Step 1/3: build with Essential features.")
          : mode === "growth"
          ? tr("Étape 2/3 : testez les outils Growth et les optimisations du site.", "Step 2/3: explore Growth tools and website improvements.")
          : tr("Étape 3/3 : faites concevoir une première proposition complète par IA, à valider avant application.", "Step 3/3: generate a complete AI website proposal, subject to your approval.")}</p>
      ) : null}
    </section>
  );
}
