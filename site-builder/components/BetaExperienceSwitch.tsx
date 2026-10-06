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
          <span>ELTARA BETA</span>
          <div>
            <b>{tr("Tester l’expérience client", "Test the customer experience")}</b>
            {!compact ? (
              <small>{tr(
                "Ce sélecteur change uniquement les fonctions visibles. Vos droits bêta complets restent actifs et aucun abonnement Stripe n’est modifié.",
                "This switch only changes visible capabilities. Your full beta rights remain active and no Stripe subscription is changed."
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
      </div>
    </section>
  );
}
