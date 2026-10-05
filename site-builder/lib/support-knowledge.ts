export type SupportArticle = {
  key: string;
  category: "domain" | "billing" | "publishing" | "ai" | "data";
  titleFr: string;
  titleEn: string;
  summaryFr: string;
  summaryEn: string;
  stepsFr: string[];
  stepsEn: string[];
  href: string;
};

export const supportKnowledgeBase: SupportArticle[] = [
  {
    key: "domain-pending",
    category: "domain",
    titleFr: "Mon domaine reste en attente",
    titleEn: "My domain is still pending",
    summaryFr: "La vérification dépend de la propagation DNS publique, pas seulement de l’enregistrement du domaine dans ELTARA.",
    summaryEn: "Verification depends on public DNS propagation, not just adding the domain in ELTARA.",
    stepsFr: [
      "Ouvrez Domaines et recopiez uniquement l’enregistrement demandé par ELTARA.",
      "Ne modifiez pas les autres entrées DNS de votre domaine.",
      "Attendez la propagation puis cliquez sur Vérifier."
    ],
    stepsEn: [
      "Open Domains and copy only the DNS record requested by ELTARA.",
      "Do not change the other DNS records for your domain.",
      "Wait for propagation, then select Verify."
    ],
    href: "/domains"
  },
  {
    key: "billing-payment",
    category: "billing",
    titleFr: "Un paiement doit être régularisé",
    titleEn: "A payment needs attention",
    summaryFr: "ELTARA applique des étapes de grâce et de restriction sans supprimer immédiatement vos données.",
    summaryEn: "ELTARA applies grace and restriction stages without immediately deleting your data.",
    stepsFr: [
      "Ouvrez Facturation pour lire l’état et les échéances exactes.",
      "Si un abonnement Stripe existe, utilisez le portail sécurisé pour mettre à jour le paiement.",
      "Téléchargez une archive si vous souhaitez conserver une copie indépendante."
    ],
    stepsEn: [
      "Open Billing to see the exact status and deadlines.",
      "If a Stripe subscription exists, use the secure portal to update payment.",
      "Download an archive if you want to keep an independent copy."
    ],
    href: "/billing"
  },
  {
    key: "publishing-check",
    category: "publishing",
    titleFr: "Mon site n’est pas encore publiable",
    titleEn: "My website is not ready to publish",
    summaryFr: "Le Quality Check identifie les informations indispensables avant mise en ligne.",
    summaryEn: "The Quality Check identifies the required information before publishing.",
    stepsFr: [
      "Ouvrez la vérification finale dans ELTARA.",
      "Corrigez uniquement les étapes signalées.",
      "Publiez puis relancez le Health Center si le site public ne répond pas."
    ],
    stepsEn: [
      "Open the final review in ELTARA.",
      "Fix only the steps that are flagged.",
      "Publish, then rerun the Health Center if the public website does not respond."
    ],
    href: "/builder?step=review"
  },
  {
    key: "ai-quota",
    category: "ai",
    titleFr: "Une fonction IA est temporairement indisponible",
    titleEn: "An AI feature is temporarily unavailable",
    summaryFr: "Les quotas et garde-fous peuvent bloquer une génération sans bloquer le site ni l’édition manuelle.",
    summaryEn: "Quotas and guardrails can stop a generation without blocking the website or manual editing.",
    stepsFr: [
      "Consultez Mon offre pour voir les quotas de votre formule.",
      "Attendez la réinitialisation lorsque le quota est atteint.",
      "Continuez l’édition manuelle : le site reste disponible."
    ],
    stepsEn: [
      "Open My plan to review your plan quotas.",
      "Wait for the reset when a quota is exhausted.",
      "Continue editing manually: your website remains available."
    ],
    href: "/plans"
  },
  {
    key: "data-export",
    category: "data",
    titleFr: "Conserver une copie complète de mon site",
    titleEn: "Keep a complete copy of my website",
    summaryFr: "L’export de récupération contient la configuration et les médias disponibles, indépendamment d’une demande d’effacement.",
    summaryEn: "The recovery export contains the configuration and available media, independently from an erasure request.",
    stepsFr: [
      "Ouvrez Mes données.",
      "Téléchargez l’archive du site concerné.",
      "Ne demandez l’effacement que si vous souhaitez réellement retirer et supprimer les données."
    ],
    stepsEn: [
      "Open My data.",
      "Download the archive for the relevant website.",
      "Request erasure only if you actually want the data removed and deleted."
    ],
    href: "/data"
  }
];

export function supportArticlesForLocale(locale: "fr" | "en") {
  return supportKnowledgeBase.map((article) => ({
    key: article.key,
    category: article.category,
    title: locale === "en" ? article.titleEn : article.titleFr,
    summary: locale === "en" ? article.summaryEn : article.summaryFr,
    steps: locale === "en" ? article.stepsEn : article.stepsFr,
    href: article.href
  }));
}
