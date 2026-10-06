"use client";

import type { BetaExperienceMode } from "../lib/beta-experience-mode";
import { useProductLocale } from "../lib/product-i18n";

export function BetaExperienceSwitch({
  mode,
  onChange,
  compact = false
}: {
  mode: BetaExperienceMode;
  onChange: (mode: BetaExperienceMode) => void;
  compact?: boolean;
}) {
  const { tr } = useProductLocale();

  return (
    <section className={"beta-experience-switch " + (compact ? "is-compact" : "")} aria-label={tr("Mode de test bêta", "Beta test mode")}>
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
      <div className="beta-experience-options" role="group" aria-label={tr("Offre simulée", "Simulated plan")}>
        <button
          type="button"
          className={mode === "essential" ? "active" : ""}
          aria-pressed={mode === "essential"}
          onClick={() => onChange("essential")}
        >
          <span>RUN</span>
          <b>{tr("Essentiel", "Essential")}</b>
        </button>
        <button
          type="button"
          className={mode === "growth" ? "active" : ""}
          aria-pressed={mode === "growth"}
          onClick={() => onChange("growth")}
        >
          <span>RUN + GROW</span>
          <b>Growth</b>
        </button>
      </div>
    </section>
  );
}
