import type { BillingState } from "./billing-access";

export type BillingGuideStep = {
  key: "status" | "payment" | "recovery";
  status: "done" | "current" | "waiting" | "optional";
  titleFr: string;
  titleEn: string;
  detailFr: string;
  detailEn: string;
  href: string | null;
};

const normalStates = new Set(["free", "trial", "active"]);

export function billingStateLabel(state: string, locale: "fr" | "en") {
  const labels: Record<string, [string, string]> = {
    free: ["Gratuit", "Free"],
    trial: ["Essai", "Trial"],
    active: ["Actif", "Active"],
    grace: ["Paiement à régulariser", "Payment needs attention"],
    restricted: ["Accès restreint", "Access restricted"],
    public_suspended: ["Site public suspendu", "Public website suspended"],
    retention: ["Fenêtre de récupération", "Recovery window"],
    closed: ["Accès clôturé", "Access closed"]
  };
  const value = labels[state] || [state, state];
  return locale === "en" ? value[1] : value[0];
}

export function billingGuide(billing: BillingState): BillingGuideStep[] {
  const normal = normalStates.has(billing.state);
  const needsPayment = ["grace", "restricted", "public_suspended"].includes(billing.state);
  const recoveryOnly = ["retention", "closed"].includes(billing.state);

  return [
    {
      key: "status",
      status: normal ? "done" : "current",
      titleFr: "Comprendre votre état",
      titleEn: "Understand your status",
      detailFr: normal
        ? "Votre accès fonctionne normalement selon votre offre."
        : needsPayment
          ? "Un incident de paiement fait progresser votre site dans la politique de protection des impayés. Les données ne sont pas supprimées immédiatement."
          : "Votre site est dans une phase de récupération ou de clôture. L’export reste la priorité tant qu’il est disponible.",
      detailEn: normal
        ? "Your access is operating normally according to your plan."
        : needsPayment
          ? "A payment issue is moving your website through the failed-payment protection policy. Data is not deleted immediately."
          : "Your website is in a recovery or closure phase. Export is the priority while it remains available.",
      href: null
    },
    {
      key: "payment",
      status: normal ? "optional" : needsPayment ? "current" : "waiting",
      titleFr: "Gérer le paiement",
      titleEn: "Manage payment",
      detailFr: normal
        ? "Vous pouvez gérer votre abonnement depuis Stripe lorsqu’un compte de facturation est rattaché."
        : needsPayment
          ? billing.hasBillingAccount
            ? "Ouvrez le portail Stripe pour mettre à jour votre moyen de paiement ou votre abonnement. La réactivation est confirmée côté serveur après synchronisation."
            : "Aucun compte Stripe n’est rattaché à ce site. Consultez Mon offre pour choisir une formule disponible."
          : "La régularisation de paiement n’est plus l’action principale à cette étape ; conservez d’abord vos données.",
      detailEn: normal
        ? "You can manage your subscription in Stripe when a billing account is linked."
        : needsPayment
          ? billing.hasBillingAccount
            ? "Open the Stripe portal to update your payment method or subscription. Reactivation is confirmed server-side after synchronization."
            : "No Stripe billing account is linked to this website. Open My plan to choose an available plan."
          : "Payment restoration is no longer the primary action at this stage; preserve your data first.",
      href: billing.hasBillingAccount ? null : "/plans"
    },
    {
      key: "recovery",
      status: recoveryOnly ? "current" : normal ? "optional" : "waiting",
      titleFr: "Conserver une copie",
      titleEn: "Keep a copy",
      detailFr: recoveryOnly
        ? "Téléchargez l’archive complète avant la fin de la fenêtre d’export indiquée."
        : "L’export complet reste disponible comme filet de sécurité. Un impayé ne supprime jamais immédiatement vos données.",
      detailEn: recoveryOnly
        ? "Download the full archive before the displayed export window ends."
        : "A full export remains available as a safety net. A failed payment never immediately deletes your data.",
      href: null
    }
  ];
}
