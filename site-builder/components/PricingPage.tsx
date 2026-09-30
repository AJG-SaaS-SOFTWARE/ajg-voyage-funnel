"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./PricingPage.module.css";

type Locale = "fr" | "en";
type BillingCycle = "monthly" | "annual";

type PricingPageProps = { locale: Locale; annualIncludesLaunch?: boolean };

const copy = {
  fr: {
    navLabel: "Tarifs AJG Site Builder",
    switchLabel: "English",
    switchHref: "/pricing",
    eyebrow: "AJG Site Builder · Tarifs",
    title: "Créez. Gérez. Faites progresser.",
    subtitle:
      "BUILD, RUN, GROW : payez la création complète quand vous en avez besoin, puis choisissez le niveau de service récurrent adapté à votre site.",
    phase: "Bêta privée · paiements commerciaux encore désactivés",
    monthly: "Mensuel",
    annual: "Annuel",
    annualHint: "2 mois équivalents offerts",
    essential: {
      name: "Essentiel",
      badge: "RUN",
      monthlyPrice: "15 €",
      annualPrice: "150 €",
      suffixMonthly: "/ mois",
      suffixAnnual: "/ an",
      description: "Pour garder un site professionnel en ligne, le modifier et le maintenir en autonomie.",
      features: [
        "1 site professionnel",
        "Hébergement et publication inclus",
        "Domaine personnalisé",
        "Éditeur complet et personnalisation",
        "IA rédactionnelle dans les champs utiles",
        "SEO et analytics essentiels",
        "Sauvegardes et outils self-service"
      ],
      cta: "Choisir Essentiel"
    },
    growth: {
      name: "Growth",
      badge: "RUN + GROW",
      monthlyPrice: "29 €",
      annualPrice: "290 €",
      suffixMonthly: "/ mois",
      suffixAnnual: "/ an",
      description: "Pour analyser le site, détecter les opportunités et l'améliorer continuellement avec l'IA.",
      features: [
        "Tout Essentiel",
        "AI Website Manager",
        "Diagnostics et recommandations continues",
        "SEO / AEO et opportunités de contenu",
        "Analyse conversion et CTA",
        "Création et adaptation de pages",
        "Capacité IA supérieure",
        "Création IA initiale incluse avec Growth annuel"
      ],
      cta: "Choisir Growth"
    },
    launch: {
      badge: "BUILD",
      name: "Création IA complète",
      price: "49 €",
      suffix: "une fois",
      description:
        "Le Concepteur IA transforme votre brief en première version complète : stratégie, architecture, pages, textes, direction visuelle, audit et raffinement.",
      note: "S'ajoute à Essentiel ou Growth mensuel. Incluse avec Growth annuel."
    },
    promiseTitle: "Un abonnement pour le service rendu chaque mois.",
    promise:
      "Essentiel paie le RUN. Growth paie le pilotage et l'amélioration continue. La création initiale n'est pas artificiellement transformée en abonnement.",
    betaTitle: "Bêta privée en cours",
    beta:
      "Les Beta Testers disposent temporairement de l'accès complet pour tester BUILD, RUN et GROW sans abonnement Stripe.",
    billingNote:
      "Le catalogue sandbox est préparé, mais aucun paiement commercial n'est ouvert tant que les gates juridiques, fiscaux et opérationnels ne sont pas validés.",
    account: "Mon offre",
    builder: "Ouvrir le Builder",
    legal: "Mentions légales",
    privacy: "Confidentialité",
    terms: "Conditions",
    cancel: "Résiliation"
  },
  en: {
    navLabel: "AJG Site Builder Pricing",
    switchLabel: "Français",
    switchHref: "/tarifs",
    eyebrow: "AJG Site Builder · Pricing",
    title: "Build. Run. Grow.",
    subtitle:
      "BUILD, RUN, GROW: pay for full website creation when you need it, then choose the recurring service level that fits your website.",
    phase: "Private beta · commercial payments still disabled",
    monthly: "Monthly",
    annual: "Annual",
    annualHint: "Equivalent of 2 months free",
    essential: {
      name: "Essential",
      badge: "RUN",
      monthlyPrice: "€15",
      annualPrice: "€150",
      suffixMonthly: "/ month",
      suffixAnnual: "/ year",
      description: "For keeping a professional website online, editable and maintained with self-service tools.",
      features: [
        "1 professional website",
        "Hosting and publishing included",
        "Custom domain",
        "Full editor and customization",
        "AI writing assistance in useful fields",
        "Essential SEO and analytics",
        "Backups and self-service tools"
      ],
      cta: "Choose Essential"
    },
    growth: {
      name: "Growth",
      badge: "RUN + GROW",
      monthlyPrice: "€29",
      annualPrice: "€290",
      suffixMonthly: "/ month",
      suffixAnnual: "/ year",
      description: "For analyzing your website, finding opportunities and improving it continuously with AI.",
      features: [
        "Everything in Essential",
        "AI Website Manager",
        "Continuous diagnostics and recommendations",
        "SEO / AEO and content opportunities",
        "Conversion and CTA analysis",
        "Page creation and adaptation",
        "Higher AI capacity",
        "Initial AI Launch included with annual Growth"
      ],
      cta: "Choose Growth"
    },
    launch: {
      badge: "BUILD",
      name: "Full AI Launch",
      price: "€49",
      suffix: "one time",
      description:
        "The AI Site Architect turns your brief into a complete first version: strategy, architecture, pages, copy, visual direction, audit and refinement.",
      note: "Add it to Essential or monthly Growth. Included with annual Growth."
    },
    promiseTitle: "A subscription for value delivered every month.",
    promise:
      "Essential pays for RUN. Growth pays for ongoing management and improvement. Initial creation is not artificially turned into a subscription.",
    betaTitle: "Private beta in progress",
    beta:
      "Beta Testers temporarily receive full access to BUILD, RUN and GROW without a Stripe subscription.",
    billingNote:
      "The sandbox catalogue is prepared, but commercial charging stays closed until legal, tax and operational launch gates are approved.",
    account: "My plan",
    builder: "Open Builder",
    legal: "Legal notice",
    privacy: "Privacy",
    terms: "Terms",
    cancel: "Cancellation"
  }
} as const;

export function PricingPage({ locale, annualIncludesLaunch = false }: PricingPageProps) {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const t = copy[locale];
  const price = (plan: typeof t.essential | typeof t.growth) =>
    cycle === "monthly"
      ? { price: plan.monthlyPrice, suffix: plan.suffixMonthly }
      : { price: plan.annualPrice, suffix: plan.suffixAnnual };
  const essentialPrice = price(t.essential);
  const growthPrice = price(t.growth);

  return (
    <main className={styles.page} lang={locale}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand} aria-label="AJG Site Builder">
          <span className={styles.brandMark} aria-hidden="true">A</span>
          <span>AJG Site Builder</span>
        </Link>
        <nav className={styles.topnav} aria-label={t.navLabel}>
          <Link href="/plans">{t.account}</Link>
          <Link href="/builder">{t.builder}</Link>
          <Link href={t.switchHref} hrefLang={locale === "fr" ? "en" : "fr"} className={styles.languageLink}>{t.switchLabel}</Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <p className={styles.eyebrow}>{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p className={styles.subtitle}>{t.subtitle}</p>
        <div className={styles.trialBadge}>{t.phase}</div>
      </section>

      <article className={styles.launchCard}>
        <div>
          <p className={styles.planBadge}>{t.launch.badge}</p>
          <h2>{t.launch.name}</h2>
          <p className={styles.description}>{t.launch.description}</p>
          <p className={styles.launchNote}>{annualIncludesLaunch ? t.launch.note : locale === "fr" ? "Création IA disponible séparément avec Essentiel ou Growth : 49 € une fois." : "AI Launch is available separately with Essential or Growth: €49 once."}</p>
        </div>
        <p className={styles.price}>{t.launch.price} <small>{t.launch.suffix}</small></p>
      </article>

      <section className={styles.controls} aria-label={locale === "fr" ? "Fréquence de facturation" : "Billing frequency"}>
        <button type="button" className={cycle === "monthly" ? styles.activeCycle : ""} onClick={() => setCycle("monthly")}>{t.monthly}</button>
        <button type="button" className={cycle === "annual" ? styles.activeCycle : ""} onClick={() => setCycle("annual")}>{t.annual}<small>{t.annualHint}</small></button>
      </section>

      <section className={styles.grid} aria-label={t.navLabel}>
        <article className={styles.card}>
          <p className={styles.planBadge}>{t.essential.badge}</p>
          <h2>{t.essential.name}</h2>
          <p className={styles.price}>{essentialPrice.price} <small>{essentialPrice.suffix}</small></p>
          <p className={styles.description}>{t.essential.description}</p>
          <ul>{t.essential.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
          <Link className={styles.secondaryCta} href="/login">{t.essential.cta}</Link>
        </article>

        <article className={styles.card + " " + styles.proCard}>
          <p className={styles.planBadge + " " + styles.proBadge}>{t.growth.badge}</p>
          <h2>{t.growth.name}</h2>
          <p className={styles.price}>{growthPrice.price} <small>{growthPrice.suffix}</small></p>
          <p className={styles.description}>{t.growth.description}</p>
          <ul>{t.growth.features.map((feature, index) => <li key={feature}>{index === t.growth.features.length - 1 && !annualIncludesLaunch ? locale === "fr" ? "Création IA disponible séparément : 49 € une fois" : "AI Launch available separately: €49 once" : feature}</li>)}</ul>
          <Link className={styles.primaryCta} href="/login">{t.growth.cta}</Link>
        </article>
      </section>

      <section className={styles.valueSection}>
        <div><p className={styles.eyebrow}>{t.promiseTitle}</p><p>{t.promise}</p></div>
        <div><p className={styles.eyebrow}>{t.betaTitle}</p><p>{t.beta}</p></div>
      </section>

      <p className={styles.billingNote}>{t.billingNote}</p>
      <footer className={styles.legalFooter}>
        <Link href={locale === "fr" ? "/mentions-legales" : "/legal"}>{t.legal}</Link>
        <Link href={locale === "fr" ? "/confidentialite" : "/privacy"}>{t.privacy}</Link>
        <Link href={locale === "fr" ? "/cgv" : "/terms"}>{t.terms}</Link>
        <Link href={locale === "fr" ? "/resilier" : "/cancel"}>{t.cancel}</Link>
      </footer>
    </main>
  );
}
