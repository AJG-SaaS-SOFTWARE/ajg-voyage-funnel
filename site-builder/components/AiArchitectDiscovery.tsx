"use client";

import Link from "next/link";
import { useProductLocale } from "../lib/product-i18n";
import styles from "./AiArchitectDiscovery.module.css";

/** Prebuilt illustrative content: zero AI calls, no access modification. */
export function AiArchitectDiscovery() {
  const { tr } = useProductLocale();
  return (
    <section className={styles.panel} aria-label={tr("Aperçu du Concepteur IA", "AI Architect preview")}>
      <div className={styles.intro}>
        <span className={styles.eyebrow}>{tr("ELTARA BUILD · APERÇU GRATUIT", "ELTARA BUILD · FREE PREVIEW")}</span>
        <h2>{tr("Imaginez votre site déjà structuré par l'IA.", "Imagine your website already structured by AI.")}</h2>
        <p>{tr(
          "Un exemple concret de ce que le Concepteur IA peut proposer, sans générer de contenu ni toucher à votre site actuel.",
          "A concrete example of what AI Architect can propose, without generating content or touching your current website."
        )}</p>
      </div>
      <div className={styles.comparison}>
        <article className={styles.before}>
          <span className={styles.flag}>{tr("AVANT · VOTRE IDÉE", "BEFORE · YOUR IDEA")}</span>
          <p>{tr(
            "« Je lance mon activité de coaching. Je veux présenter mes services et obtenir des rendez-vous. »",
            "“I'm launching my coaching business. I want to introduce my services and get appointments.”"
          )}</p>
        </article>
        <div className={styles.arrow} aria-hidden="true">→</div>
        <article className={styles.after}>
          <span className={styles.flag}>{tr("APRÈS · PROPOSITION ILLUSTRATIVE", "AFTER · SAMPLE PROPOSAL")}</span>
          <div className={styles.mockup}>
            <div className={styles.mockHeader}><span>{tr("ÉLAN STUDIO", "ELAN STUDIO")}</span><span>☰</span></div>
            <div className={styles.mockHero}>
              <span>{tr("COACHING & ACCOMPAGNEMENT", "COACHING & GUIDANCE")}</span>
              <strong>{tr("Avancez avec clarté.", "Move forward with clarity.")}</strong>
              <small>{tr("Un accompagnement pensé pour vos objectifs.", "Support tailored to your goals.")}</small>
              <span className={styles.mockButton}>{tr("Prendre rendez-vous", "Book a call")}</span>
            </div>
            <div className={styles.mockFooter}><i /><i /><i /></div>
          </div>
          <small>{tr(
            "Pages proposées : Accueil · Services · À propos · Contact",
            "Suggested pages: Home · Services · About · Contact"
          )}</small>
        </article>
      </div>
      <div className={styles.bottom}>
        <p>{tr(
          "BUILD prépare l'architecture, les textes et la direction visuelle, puis vous laisse valider. Exemple fictif : les résultats réels dépendent de votre brief.",
          "BUILD prepares structure, copy and visual direction for your approval. Fictional example: actual results depend on your brief."
        )}</p>
        <div className={styles.actions}>
          <Link className="button primary" href="/plans#ai-launch">{tr("Découvrir BUILD · 49 €", "Explore BUILD · €49")}</Link>
          <Link className="button secondary" href="/tarifs">{tr("Comparer avec Growth", "Compare with Growth")}</Link>
        </div>
        <small>{tr(
          "Démonstration statique sans coût IA. Growth mensuel et Création IA sont deux offres distinctes ; les paiements commerciaux sont actuellement désactivés.",
          "Static demonstration with no AI cost. Monthly Growth and AI Launch are separate offers; commercial payments are currently disabled."
        )}</small>
      </div>
    </section>
  );
}
