"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./PricingPage.module.css";

type Locale = "fr" | "en";
type BillingCycle = "monthly" | "annual";

type PricingPageProps = {
  locale: Locale;
};

const copy = {
  fr: {
    navLabel: "Tarifs AJG Site Builder",
    switchLabel: "English",
    switchHref: "/pricing",
    eyebrow: "AJG Site Builder · Tarifs",
    title: "Choisissez jusqu’où vous voulez être accompagné.",
    subtitle:
      "Construisez vous-même avec l’aide de l’IA, ou laissez le Concepteur IA préparer votre première version. Dans les deux cas, vous gardez la main sur chaque texte, section et choix de design.",
    trial: "14 jours d’essai avec l’expérience Pro IA au lancement commercial",
    monthly: "Mensuel",
    annual: "Annuel",
    annualHint: "2 mois équivalents offerts",
    essential: {
      name: "Essentiel",
      badge: "Créer avec l’IA",
      monthlyPrice: "19 €",
      annualPrice: "190 €",
      suffixMonthly: "/ mois",
      suffixAnnual: "/ an",
      description:
        "Pour construire et gérer votre site avec un éditeur complet et l’IA rédactionnelle là où elle fait gagner du temps.",
      features: [
        "1 site professionnel",
        "Éditeur complet et personnalisation",
        "Hébergement et publication inclus",
        "Domaine personnalisé",
        "IA rédactionnelle dans les champs utiles",
        "Réécriture, amélioration et suggestions de contenu",
        "SEO essentiel et design responsive",
        "Sans Concepteur IA complet"
      ],
      cta: "Créer mon compte"
    },
    pro: {
      name: "Pro IA",
      badge: "Recommandé",
      monthlyPrice: "39 €",
      annualPrice: "390 €",
      suffixMonthly: "/ mois",
      suffixAnnual: "/ an",
      description:
        "Pour partir d’un brief et obtenir beaucoup plus vite une première version structurée, cohérente et entièrement modifiable.",
      features: [
        "Tout Essentiel",
        "Concepteur IA de site",
        "Structure et sections proposées à partir du brief",
        "Premiers textes générés puis entièrement éditables",
        "Aide IA renforcée pour les itérations",
        "Quota IA supérieur",
        "Capacité média et stockage supérieure",
        "Accès prioritaire aux nouveaux modules IA"
      ],
      cta: "Tester le Concepteur IA"
    },
    promiseTitle: "Pas un builder low-cost de plus.",
    promise:
      "AJG Site Builder est conçu pour réduire la page blanche, les hésitations et la complexité entre « j’ai besoin d’un site » et « j’ai un site que je peux réellement publier et faire évoluer ».",
    betaTitle: "Bêta privée en cours",
    beta:
      "Les Beta Testers invités disposent temporairement de l’accès Pro complet sans abonnement Stripe. Ce statut n’est pas une offre publique et n’apparaît pas dans la grille commerciale.",
    billingNote:
      "Les paiements restent désactivés pendant la bêta. Les prix ci-dessus sont la grille commerciale retenue pour préparer l’ouverture de Stripe et seront synchronisés avec les CGV/CGU avant encaissement.",
    account: "Mon offre",
    builder: "Ouvrir le Builder"
  },
  en: {
    navLabel: "AJG Site Builder Pricing",
    switchLabel: "Français",
    switchHref: "/tarifs",
    eyebrow: "AJG Site Builder · Pricing",
    title: "Choose how much help you want.",
    subtitle:
      "Build your website yourself with AI-assisted writing, or let the AI Site Architect prepare your first structured version. Either way, every section, text and design choice stays editable.",
    trial: "14-day Pro AI experience at commercial launch",
    monthly: "Monthly",
    annual: "Annual",
    annualHint: "Equivalent of 2 months free",
    essential: {
      name: "Essential",
      badge: "Build with AI",
      monthlyPrice: "€19",
      annualPrice: "€190",
      suffixMonthly: "/ month",
      suffixAnnual: "/ year",
      description:
        "For people who want full control of the editor with AI writing assistance where it saves the most time.",
      features: [
        "1 professional website",
        "Full editor and customization",
        "Hosting and publishing included",
        "Custom domain",
        "AI writing assistance in high-value fields",
        "Rewrite, improve and suggest content",
        "Essential SEO and responsive design",
        "AI Site Architect not included"
      ],
      cta: "Create my account"
    },
    pro: {
      name: "Pro AI",
      badge: "Recommended",
      monthlyPrice: "€39",
      annualPrice: "€390",
      suffixMonthly: "/ month",
      suffixAnnual: "/ year",
      description:
        "For people who want to start from a brief and get a structured, coherent and fully editable first version much faster.",
      features: [
        "Everything in Essential",
        "AI Site Architect",
        "Structure and sections proposed from your brief",
        "First-draft copy generated and fully editable",
        "Stronger AI support for iterations",
        "Higher AI allowance",
        "Higher media and storage capacity",
        "Priority access to new AI modules"
      ],
      cta: "Try the AI Site Architect"
    },
    promiseTitle: "Not another low-cost website builder.",
    promise:
      "AJG Site Builder is designed to reduce blank-page anxiety, hesitation and complexity between “I need a website” and “I have a website I can actually publish and improve.”",
    betaTitle: "Private beta in progress",
    beta:
      "Invited Beta Testers temporarily receive full Pro access without a Stripe subscription. This status is not a public plan and is intentionally excluded from the commercial pricing grid.",
    billingNote:
      "Payments remain disabled during the beta. The prices above are the commercial grid selected to prepare Stripe launch and will be synchronized with the final terms before any charge is collected.",
    account: "My plan",
    builder: "Open Builder"
  }
} as const;

export function PricingPage({ locale }: PricingPageProps) {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const t = copy[locale];

  const planPrice = (plan: typeof t.essential | typeof t.pro) =>
    cycle === "monthly"
      ? { price: plan.monthlyPrice, suffix: plan.suffixMonthly }
      : { price: plan.annualPrice, suffix: plan.suffixAnnual };

  const essentialPrice = planPrice(t.essential);
  const proPrice = planPrice(t.pro);

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
        <div className={styles.trialBadge}>{t.trial}</div>
      </section>

      <section className={styles.controls} aria-label={locale === "fr" ? "Fréquence de facturation" : "Billing frequency"}>
        <button
          type="button"
          className={cycle === "monthly" ? styles.activeCycle : ""}
          onClick={() => setCycle("monthly")}
        >
          {t.monthly}
        </button>
        <button
          type="button"
          className={cycle === "annual" ? styles.activeCycle : ""}
          onClick={() => setCycle("annual")}
        >
          {t.annual}
          <small>{t.annualHint}</small>
        </button>
      </section>

      <section className={styles.grid} aria-label={t.navLabel}>
        <article className={styles.card}>
          <p className={styles.planBadge}>{t.essential.badge}</p>
          <h2>{t.essential.name}</h2>
          <p className={styles.price}>{essentialPrice.price} <small>{essentialPrice.suffix}</small></p>
          <p className={styles.description}>{t.essential.description}</p>
          <ul>
            {t.essential.features.map((feature) => <li key={feature}>{feature}</li>)}
          </ul>
          <Link className={styles.secondaryCta} href="/login">{t.essential.cta}</Link>
        </article>

        <article className={styles.card + " " + styles.proCard}>
          <p className={styles.planBadge + " " + styles.proBadge}>{t.pro.badge}</p>
          <h2>{t.pro.name}</h2>
          <p className={styles.price}>{proPrice.price} <small>{proPrice.suffix}</small></p>
          <p className={styles.description}>{t.pro.description}</p>
          <ul>
            {t.pro.features.map((feature) => <li key={feature}>{feature}</li>)}
          </ul>
          <Link className={styles.primaryCta} href="/login">{t.pro.cta}</Link>
        </article>
      </section>

      <section className={styles.valueSection}>
        <div>
          <p className={styles.eyebrow}>{t.promiseTitle}</p>
          <p>{t.promise}</p>
        </div>
        <div>
          <p className={styles.eyebrow}>{t.betaTitle}</p>
          <p>{t.beta}</p>
        </div>
      </section>

      <p className={styles.billingNote}>{t.billingNote}</p>
    </main>
  );
}
