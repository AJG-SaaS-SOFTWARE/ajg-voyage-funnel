export type CustomerErrorGuidance = {
  titleFr: string;
  titleEn: string;
  actionFr: string;
  actionEn: string;
  href: string;
};

const rules: Array<{ match: RegExp; guidance: CustomerErrorGuidance }> = [
  {
    match: /(reconnect|connexion|sign in|session|unauthorized)/i,
    guidance: {
      titleFr: "Session ou connexion à renouveler",
      titleEn: "Session or sign-in needs refreshing",
      actionFr: "Reconnectez-vous puis relancez l’action.",
      actionEn: "Sign in again, then retry the action.",
      href: "/login"
    }
  },
  {
    match: /(dns|domaine|domain|verification failed|échec de vérification)/i,
    guidance: {
      titleFr: "Le blocage concerne le domaine",
      titleEn: "The issue is related to the domain",
      actionFr: "Ouvrez le parcours Domaine pour vérifier uniquement les enregistrements demandés par ELTARA.",
      actionEn: "Open the Domain flow and check only the DNS records requested by ELTARA.",
      href: "/domains"
    }
  },
  {
    match: /(paiement|billing|subscription|abonnement|restricted|suspendu|suspended)/i,
    guidance: {
      titleFr: "L’accès dépend de la facturation",
      titleEn: "Access depends on billing",
      actionFr: "Consultez l’état de facturation et le moyen de paiement avant de réessayer.",
      actionEn: "Check billing status and the payment method before trying again.",
      href: "/billing"
    }
  },
  {
    match: /(quota|stockage|storage|limite|limit|reached|atteint)/i,
    guidance: {
      titleFr: "Une limite d’usage a été atteinte",
      titleEn: "A usage limit has been reached",
      actionFr: "Vérifiez votre offre et vos quotas. Supprimez les éléments inutiles ou adaptez l’offre si nécessaire.",
      actionEn: "Check your plan and quotas. Remove unused items or adjust the plan if needed.",
      href: "/plans"
    }
  },
  {
    match: /(export|archive|données|data)/i,
    guidance: {
      titleFr: "Le problème concerne vos données ou l’export",
      titleEn: "The issue concerns your data or export",
      actionFr: "Ouvrez Mes données pour relancer l’export ou vérifier l’état de la demande.",
      actionEn: "Open My data to retry the export or check the request status.",
      href: "/data"
    }
  },
  {
    match: /(publication|publish|publier|site public)/i,
    guidance: {
      titleFr: "Le blocage concerne la publication",
      titleEn: "The issue concerns publishing",
      actionFr: "Ouvrez ELTARA, vérifiez le Quality Check et relancez la publication.",
      actionEn: "Open ELTARA, review the Quality Check and publish again.",
      href: "/builder"
    }
  },
  {
    match: /(impossible|indisponible|unavailable|failed|error|erreur|échec)/i,
    guidance: {
      titleFr: "ELTARA n’a pas pu terminer l’action",
      titleEn: "ELTARA could not complete the action",
      actionFr: "Relancez une fois l’action. Si le problème persiste, ouvrez le Health Center : le diagnostic technique sera prérempli.",
      actionEn: "Retry the action once. If it still fails, open the Health Center: the technical diagnosis will already be available.",
      href: "/support"
    }
  }
];

export function explainCustomerError(message: string | null | undefined) {
  const value = String(message || "").trim();
  if (!value) return null;
  return rules.find((rule) => rule.match.test(value))?.guidance || null;
}
