export type SupportCheckStatus = "healthy" | "action" | "incident";

export type SupportCheck = {
  key: "backend" | "publication" | "public_render" | "domain" | "billing" | "backup" | "ai";
  label: string;
  status: SupportCheckStatus;
  detail: string;
  clientAction?: string;
};

export type SupportDiagnosis = {
  overall: SupportCheckStatus;
  checks: SupportCheck[];
  clientAction: string | null;
  generatedAt: string;
};

export type SupportDiagnosticInput = {
  backendOk: boolean;
  site: null | {
    id: string;
    slug: string;
    status: string;
    publicAccessState?: string | null;
  };
  domains: Array<{
    hostname: string;
    verificationStatus: string;
    isPrimary: boolean;
  }>;
  billingState?: string | null;
  publicRender?: {
    checked: boolean;
    ok: boolean;
    status: number | null;
  };
  backup?: {
    configured: boolean;
    status: "healthy" | "warning" | "critical" | "unknown";
    ageHours: number | null;
  };
  ai?: {
    enabled: boolean;
    heavyEnabled: boolean;
  };
};

const priority: Record<SupportCheckStatus, number> = {
  healthy: 0,
  action: 1,
  incident: 2
};

function strongest(checks: SupportCheck[]): SupportCheckStatus {
  return checks.reduce<SupportCheckStatus>(
    (result, check) => priority[check.status] > priority[result] ? check.status : result,
    "healthy"
  );
}

export function buildSupportDiagnosis(input: SupportDiagnosticInput): SupportDiagnosis {
  const checks: SupportCheck[] = [];

  checks.push(
    input.backendOk
      ? {
          key: "backend",
          label: "Service Builder",
          status: "healthy",
          detail: "Le backend répond et la session a pu être vérifiée."
        }
      : {
          key: "backend",
          label: "Service Builder",
          status: "incident",
          detail: "Le backend ou la base de données ne répond pas normalement.",
          clientAction: "Réessayez dans quelques minutes. Le ticket reste transmis à AJG si le service ne revient pas."
        }
  );

  if (!input.site) {
    checks.push({
      key: "publication",
      label: "Site",
      status: "action",
      detail: "Aucun site n'est encore rattaché à ce compte.",
      clientAction: "Créez d'abord votre site depuis le Builder, puis relancez le diagnostic."
    });
    checks.push({
      key: "domain",
      label: "Domaine",
      status: "healthy",
      detail: "Aucun diagnostic de domaine n'est nécessaire tant qu'aucun site n'existe."
    });
    checks.push({
      key: "billing",
      label: "Accès",
      status: "healthy",
      detail: "Aucun blocage de site lié à la facturation n'a été détecté."
    });
  } else {
    const publicAccess = input.site.publicAccessState || "live";
    if (publicAccess === "suspended") {
      checks.push({
        key: "publication",
        label: "Publication",
        status: "incident",
        detail: "Le site est actuellement suspendu côté accès public.",
        clientAction: "Consultez la rubrique Facturation. Si votre situation est à jour, laissez ce ticket ouvert pour vérification AJG."
      });
    } else if (input.site.status === "published") {
      checks.push({
        key: "publication",
        label: "Publication",
        status: "healthy",
        detail: "Le site est marqué comme publié et son accès public est autorisé."
      });
    } else {
      checks.push({
        key: "publication",
        label: "Publication",
        status: "action",
        detail: "Le site est encore en brouillon.",
        clientAction: "Terminez le Quality Check puis publiez le site depuis le Builder."
      });
    }

    const primary = input.domains.find((item) => item.isPrimary);
    const verified = input.domains.find((item) => item.verificationStatus === "verified");
    const failed = input.domains.find((item) => item.verificationStatus === "failed");
    const pending = input.domains.find((item) => item.verificationStatus === "pending");

    if (primary?.verificationStatus === "verified" || verified) {
      const domain = primary?.verificationStatus === "verified" ? primary : verified!;
      checks.push({
        key: "domain",
        label: "Domaine",
        status: "healthy",
        detail: `${domain.hostname} est vérifié.`
      });
    } else if (failed) {
      checks.push({
        key: "domain",
        label: "Domaine",
        status: "action",
        detail: `${failed.hostname} n'a pas pu être vérifié.`,
        clientAction: "Ouvrez la rubrique Domaine et contrôlez les enregistrements DNS demandés."
      });
    } else if (pending) {
      checks.push({
        key: "domain",
        label: "Domaine",
        status: "action",
        detail: `${pending.hostname} est encore en attente de vérification DNS.`,
        clientAction: "Vérifiez les DNS indiqués dans la rubrique Domaine puis relancez la vérification."
      });
    } else {
      checks.push({
        key: "domain",
        label: "Domaine",
        status: "healthy",
        detail: "Aucun domaine personnalisé en erreur n'a été détecté."
      });
    }

    const billingState = input.billingState || "active";
    if (["restricted", "public_suspended", "retention", "closed"].includes(billingState)) {
      checks.push({
        key: "billing",
        label: "Facturation",
        status: "incident",
        detail: `L'accès du site est dans l'état « ${billingState} ».`,
        clientAction: "Ouvrez la rubrique Facturation pour régulariser ou vérifier l'état de l'abonnement."
      });
    } else if (billingState === "grace") {
      checks.push({
        key: "billing",
        label: "Facturation",
        status: "action",
        detail: "Le compte est en période de grâce après un incident de paiement.",
        clientAction: "Mettez à jour le moyen de paiement depuis la rubrique Facturation avant la fin du délai de grâce."
      });
    } else {
      checks.push({
        key: "billing",
        label: "Facturation",
        status: "healthy",
        detail: "Aucun blocage de facturation n'est détecté pour ce site."
      });
    }
  }

  if (input.site?.status === "published" && (input.site.publicAccessState || "live") !== "suspended") {
    const render = input.publicRender;
    if (!render?.checked) {
      checks.push({
        key: "public_render",
        label: "Site public",
        status: "action",
        detail: "Le contrôle HTTP du site public n'a pas pu être exécuté."
      });
    } else if (render.ok) {
      checks.push({
        key: "public_render",
        label: "Site public",
        status: "healthy",
        detail: "Le rendu public répond correctement en HTTPS."
      });
    } else {
      checks.push({
        key: "public_render",
        label: "Site public",
        status: "incident",
        detail: `Le rendu public ne répond pas normalement${render.status ? ` (HTTP ${render.status})` : ""}.`
      });
    }
  }

  if (input.backup) {
    if (input.backup.configured && input.backup.status === "healthy") {
      checks.push({
        key: "backup",
        label: "Sauvegarde",
        status: "healthy",
        detail: input.backup.ageHours === null
          ? "La sauvegarde externe est configurée."
          : `La dernière sauvegarde externe date d'environ ${Math.round(input.backup.ageHours)} h.`
      });
    } else if (input.backup.status === "critical") {
      checks.push({
        key: "backup",
        label: "Sauvegarde",
        status: "incident",
        detail: "La sauvegarde externe est trop ancienne et nécessite une intervention AJG."
      });
    } else {
      checks.push({
        key: "backup",
        label: "Sauvegarde",
        status: "action",
        detail: input.backup.configured
          ? "La fraîcheur de la sauvegarde externe est à surveiller."
          : "La sauvegarde externe n'est pas vérifiable actuellement."
      });
    }
  }

  if (input.ai) {
    if (!input.ai.enabled) {
      checks.push({
        key: "ai",
        label: "Service IA",
        status: "incident",
        detail: "Les fonctions IA sont suspendues globalement par le garde-fou AJG."
      });
    } else if (!input.ai.heavyEnabled) {
      checks.push({
        key: "ai",
        label: "Service IA",
        status: "action",
        detail: "L'IA légère reste disponible mais les opérations lourdes sont temporairement suspendues."
      });
    } else {
      checks.push({
        key: "ai",
        label: "Service IA",
        status: "healthy",
        detail: "Les garde-fous globaux autorisent les fonctions IA."
      });
    }
  }

  const overall = strongest(checks);
  const actionable = checks.find((check) => check.status === "incident" && check.clientAction)
    || checks.find((check) => check.status === "action" && check.clientAction);

  return {
    overall,
    checks,
    clientAction: actionable?.clientAction || null,
    generatedAt: new Date().toISOString()
  };
}
