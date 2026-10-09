"use client";

import Link from "next/link";
import { useProductLocale } from "../lib/product-i18n";

/** Static, zero-token preview; no model call, free entitlement or simulated unlock. */
export function AiArchitectDiscovery() {
  const { tr } = useProductLocale();
  return (
    <section className="advanced-discovery-card" aria-label={tr("Aperçu du Concepteur IA", "AI Architect preview")}>
      <div className="advanced-discovery-body">
        <span className="advanced-discovery-kicker">BUILD · {tr("Démonstration sans IA", "No-AI demonstration")}</span>
        <b>{tr("Votre brief devient un site structuré", "Turn your brief into a structured website")}</b>
        <p>{tr(
          "Voici un exemple illustratif, non généré à partir de vos données. Le Concepteur IA propose une stratégie, une architecture, des textes et un style, que vous validez avant application.",
          "This is an illustrative example, not generated from your data. AI Architect proposes strategy, page structure, copy and design for your approval."
        )}</p>
        <ol>
          <li>{tr("Comprendre votre activité et votre objectif", "Understand your business and goals")}</li>
          <li>{tr("Proposer les pages, les textes et la direction visuelle", "Propose pages, copy and visual direction")}</li>
          <li>{tr("Vérifier la qualité puis vous laisser décider", "Check quality and let you decide")}</li>
        </ol>
        <div className="advanced-discovery-actions">
          <Link href="/plans" className="button primary">{tr("Découvrir la Création IA · 49 €", "Explore AI Launch · €49")}</Link>
          <Link href="/growth" className="button secondary">{tr("Découvrir Growth", "Explore Growth")}</Link>
        </div>
        <small>{tr(
          "Aucun appel IA ni changement de votre site durant cette présentation. Growth mensuel et Création IA initiale sont des offres distinctes.",
          "No AI request or website change during this preview. Monthly Growth and initial AI Launch are separate products."
        )}</small>
      </div>
    </section>
  );
}
