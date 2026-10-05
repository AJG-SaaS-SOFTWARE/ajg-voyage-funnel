export type DomainGuideStep = {
  key: "managed" | "custom" | "dns";
  status: "done" | "current" | "locked" | "waiting";
  titleFr: string;
  titleEn: string;
  detailFr: string;
  detailEn: string;
};

export function domainGuide(input: {
  customDomainAllowed: boolean;
  managedStatus: "pending" | "verified" | "failed" | null;
  customStatus: "pending" | "verified" | "failed" | null;
}): DomainGuideStep[] {
  const managedDone = input.managedStatus === "verified";
  const customExists = input.customStatus !== null;
  const customVerified = input.customStatus === "verified";

  return [
    {
      key: "managed",
      status: managedDone ? "done" : "waiting",
      titleFr: "Adresse ELTARA",
      titleEn: "ELTARA address",
      detailFr: managedDone
        ? "Votre sous-domaine ELTARA est opérationnel."
        : "ELTARA prépare et vérifie automatiquement votre sous-domaine. Aucune modification DNS n’est nécessaire de votre côté.",
      detailEn: managedDone
        ? "Your ELTARA subdomain is operational."
        : "ELTARA automatically prepares and verifies your subdomain. No DNS change is required from you."
    },
    {
      key: "custom",
      status: !input.customDomainAllowed ? "locked" : customExists ? "done" : "current",
      titleFr: "Ajouter votre domaine",
      titleEn: "Add your domain",
      detailFr: !input.customDomainAllowed
        ? "Le domaine personnalisé est disponible avec Essentiel ou Growth."
        : customExists
          ? "Votre domaine est enregistré dans ELTARA."
          : "Saisissez le domaine que vous possédez, sans http:// ni chemin.",
      detailEn: !input.customDomainAllowed
        ? "Custom domains are available with Essential or Growth."
        : customExists
          ? "Your domain is registered in ELTARA."
          : "Enter the domain you own, without http:// or a path."
    },
    {
      key: "dns",
      status: !input.customDomainAllowed ? "locked" : !customExists ? "waiting" : customVerified ? "done" : "current",
      titleFr: "Vérifier le DNS",
      titleEn: "Verify DNS",
      detailFr: !input.customDomainAllowed
        ? "Cette étape s’active avec un domaine personnalisé."
        : !customExists
          ? "Ajoutez d’abord votre domaine pour obtenir les instructions DNS exactes."
          : customVerified
            ? "Le DNS public répond correctement et le domaine est vérifié."
            : input.customStatus === "failed"
              ? "La dernière vérification a échoué. Contrôlez uniquement l’enregistrement demandé puis relancez la vérification."
              : "Ajoutez chez votre fournisseur DNS l’enregistrement indiqué par ELTARA, attendez la propagation puis cliquez sur Vérifier.",
      detailEn: !input.customDomainAllowed
        ? "This step becomes available with a custom domain."
        : !customExists
          ? "Add your domain first to receive the exact DNS instructions."
          : customVerified
            ? "Public DNS responds correctly and the domain is verified."
            : input.customStatus === "failed"
              ? "The last verification failed. Check only the requested record, then verify again."
              : "Add the record shown by ELTARA at your DNS provider, wait for propagation, then select Verify."
    }
  ];
}
