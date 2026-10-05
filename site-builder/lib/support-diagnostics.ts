export type SupportCheckStatus = "healthy" | "action" | "incident";
export type SupportRepairAction = "managed_domain_repair";

export type SupportCheck = {
  key: "backend" | "publication" | "public_render" | "latency" | "seo" | "sitemap" | "domain" | "billing" | "backup" | "ai" | "contact" | "images" | "content_links" | "storage" | "runtime";
  label: string;
  status: SupportCheckStatus;
  detail: string;
  clientAction?: string;
};

export type SupportDiagnosis = {
  overall: SupportCheckStatus;
  checks: SupportCheck[];
  clientAction: string | null;
  repairActions: SupportRepairAction[];
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
    kind?: "managed_subdomain" | "custom_domain" | string;
    verificationStatus: string;
    isPrimary: boolean;
  }>;
  billingState?: string | null;
  publicRender?: {
    checked: boolean;
    ok: boolean;
    status: number | null;
    durationMs?: number | null;
    canonicalPresent?: boolean;
    canonicalHttps?: boolean;
  };
  sitemap?: {
    checked: boolean;
    ok: boolean;
    status: number | null;
    validXml: boolean;
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
  content?: {
    contactEnabled: boolean;
    contactEmailValid: boolean;
    galleryEnabled: boolean;
    galleryImageCount: number;
    invalidConfiguredLinks: number;
    checkedConfiguredLinks: number;
    missingPublishableMedia: number;
  };
  storage?: {
    publicBucketAvailable: boolean;
    privateBucketAvailable: boolean;
  };
  runtime?: {
    lastHour: number;
    lastDay: number;
    distinctCodes: number;
    truncated: boolean;
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
  const repairActions: SupportRepairAction[] = [];

  checks.push(
    input.backendOk
      ? {
          key: "backend",
          label: "Service ELTARA",
          status: "healthy",
          detail: "Le backend répond et la session a pu être vérifiée."
        }
      : {
          key: "backend",
          label: "Service ELTARA",
          status: "incident",
          detail: "Le backend ou la base de données ne répond pas normalement.",
          clientAction: "Réessayez dans quelques minutes. Le ticket reste transmis à l’équipe ELTARA si le service ne revient pas."
        }
  );

  if (!input.site) {
    checks.push({
      key: "publication",
      label: "Site",
      status: "action",
      detail: "Aucun site n'est encore rattaché à ce compte.",
      clientAction: "Créez d'abord votre site depuis ELTARA, puis relancez le diagnostic."
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
        clientAction: "Consultez la rubrique Facturation. Si votre situation est à jour, laissez ce ticket ouvert pour vérification par l’équipe ELTARA."
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
        clientAction: "Terminez le Quality Check puis publiez le site depuis ELTARA."
      });
    }

    const custom = input.domains.find((item) => item.kind === "custom_domain");
    const managed = input.domains.find((item) => item.kind === "managed_subdomain");
    const primary = input.domains.find((item) => item.isPrimary);

    if (custom) {
      if (custom.verificationStatus === "verified") {
        checks.push({
          key: "domain",
          label: "Domaine",
          status: "healthy",
          detail: `${custom.hostname} est vérifié.`
        });
      } else if (custom.verificationStatus === "failed") {
        checks.push({
          key: "domain",
          label: "Domaine",
          status: "action",
          detail: `${custom.hostname} n'a pas pu être vérifié.`,
          clientAction: "Ouvrez la rubrique Domaine et contrôlez les enregistrements DNS demandés."
        });
      } else {
        checks.push({
          key: "domain",
          label: "Domaine",
          status: "action",
          detail: `${custom.hostname} est encore en attente de vérification DNS.`,
          clientAction: "Vérifiez les DNS indiqués dans la rubrique Domaine puis relancez la vérification."
        });
      }
    } else if (!managed && primary?.verificationStatus === "verified") {
      checks.push({
        key: "domain",
        label: "Domaine",
        status: "healthy",
        detail: `${primary.hostname} est vérifié.`
      });
    } else if (!managed && input.domains.length === 0 && input.site.status === "published") {
      repairActions.push("managed_domain_repair");
      checks.push({
        key: "domain",
        label: "Domaine",
        status: "action",
        detail: "Le sous-domaine ELTARA géré par la plateforme est absent. Une correction automatique est disponible."
      });
    } else if (managed?.verificationStatus === "verified" && !managed.isPrimary) {
      repairActions.push("managed_domain_repair");
      checks.push({
        key: "domain",
        label: "Domaine",
        status: "action",
        detail: `${managed.hostname} est vérifié mais n'est pas défini comme domaine primaire. Une correction automatique est disponible.`
      });
    } else if (managed?.verificationStatus === "verified") {
      checks.push({
        key: "domain",
        label: "Domaine",
        status: "healthy",
        detail: `${managed.hostname} est vérifié.`
      });
    } else if (managed) {
      repairActions.push("managed_domain_repair");
      checks.push({
        key: "domain",
        label: "Domaine",
        status: "action",
        detail: `${managed.hostname} n'est pas encore opérationnel. ELTARA peut retenter automatiquement son rattachement technique.`
      });
    } else {
      const failed = input.domains.find((item) => item.verificationStatus === "failed");
      const pending = input.domains.find((item) => item.verificationStatus === "pending");
      if (failed) {
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
          detail: "Aucun domaine en erreur n'a été détecté."
        });
      }
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

      if (typeof render.durationMs === "number") {
        checks.push(
          render.durationMs <= 3500
            ? {
                key: "latency",
                label: "Temps de réponse",
                status: "healthy",
                detail: `Le rendu public répond en environ ${Math.round(render.durationMs)} ms.`
              }
            : {
                key: "latency",
                label: "Temps de réponse",
                status: "action",
                detail: `Le rendu public a répondu en environ ${Math.round(render.durationMs)} ms, au-dessus du seuil de diagnostic de 3,5 s.`
              }
        );
      }

      if (render.canonicalPresent !== undefined) {
        checks.push(
          render.canonicalPresent && render.canonicalHttps
            ? {
                key: "seo",
                label: "Canonical",
                status: "healthy",
                detail: "La page publique expose une URL canonical HTTPS."
              }
            : {
                key: "seo",
                label: "Canonical",
                status: "action",
                detail: "La page publique ne fournit pas de canonical HTTPS exploitable."
              }
        );
      }
    } else {
      checks.push({
        key: "public_render",
        label: "Site public",
        status: "incident",
        detail: `Le rendu public ne répond pas normalement${render.status ? ` (HTTP ${render.status})` : ""}.`
      });
    }
  }

  if (input.site?.status === "published" && input.sitemap) {
    const sitemap = input.sitemap;
    if (sitemap.checked && sitemap.ok && sitemap.validXml) {
      checks.push({
        key: "sitemap",
        label: "Sitemap",
        status: "healthy",
        detail: "Le sitemap public répond et contient une structure XML exploitable."
      });
    } else if (sitemap.checked) {
      checks.push({
        key: "sitemap",
        label: "Sitemap",
        status: sitemap.status !== null && sitemap.status >= 500 ? "incident" : "action",
        detail: sitemap.status
          ? `Le sitemap ne répond pas correctement (HTTP ${sitemap.status}) ou son XML est invalide.`
          : "Le sitemap public n'a pas pu être vérifié."
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
        detail: "La sauvegarde externe est trop ancienne et nécessite une intervention de l’équipe ELTARA."
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

  if (input.content) {
    const content = input.content;

    if (content.contactEnabled) {
      checks.push(
        content.contactEmailValid
          ? {
              key: "contact",
              label: "Contact",
              status: "healthy",
              detail: "Le module de contact actif contient une adresse e-mail exploitable."
            }
          : {
              key: "contact",
              label: "Contact",
              status: "action",
              detail: "Le module de contact est actif mais son adresse e-mail n'est pas exploitable.",
              clientAction: "Ouvrez l'étape Contenu, corrigez l'adresse e-mail du module Contact puis republiez."
            }
      );
    } else {
      checks.push({
        key: "contact",
        label: "Contact",
        status: "healthy",
        detail: "Le module de contact n'est pas activé ; aucun canal de contact intégré n'est attendu."
      });
    }

    if (content.galleryEnabled && content.galleryImageCount === 0) {
      checks.push({
        key: "images",
        label: "Images",
        status: "action",
        detail: "La galerie est activée mais aucune image exploitable n'est configurée.",
        clientAction: "Ajoutez au moins une image valide à la galerie ou désactivez cette rubrique, puis republiez."
      });
    } else if (content.missingPublishableMedia > 0) {
      checks.push({
        key: "images",
        label: "Médias publiables",
        status: "action",
        detail: `${content.missingPublishableMedia} média(s) marqué(s) publiable(s) n'ont pas encore de ressource exploitable.`,
        clientAction: "Ouvrez la bibliothèque de contenus, réimportez les médias concernés ou retirez leur autorisation de publication."
      });
    } else {
      checks.push({
        key: "images",
        label: "Images",
        status: "healthy",
        detail: content.galleryEnabled
          ? `La galerie contient ${content.galleryImageCount} image(s) exploitable(s).`
          : "Aucune galerie incomplète ni média publiable manquant n'a été détecté."
      });
    }

    checks.push(
      content.invalidConfiguredLinks > 0
        ? {
            key: "content_links",
            label: "Liens configurés",
            status: "action",
            detail: `${content.invalidConfiguredLinks} lien(s) configuré(s) ne sont pas des URL HTTPS exploitables.`,
            clientAction: "Corrigez les liens signalés dans ELTARA puis republiez le site."
          }
        : {
            key: "content_links",
            label: "Liens configurés",
            status: "healthy",
            detail: content.checkedConfiguredLinks > 0
              ? `${content.checkedConfiguredLinks} lien(s) configuré(s) ont un format HTTPS valide.`
              : "Aucun lien externe configuré ne nécessite de contrôle."
          }
    );
  }

  if (input.storage) {
    const missing = [
      input.storage.publicBucketAvailable ? null : "site-media",
      input.storage.privateBucketAvailable ? null : "site-private-media"
    ].filter(Boolean);

    checks.push(
      missing.length === 0
        ? {
            key: "storage",
            label: "Stockage",
            status: "healthy",
            detail: "Les espaces de stockage public et privé d’ELTARA sont disponibles."
          }
        : {
            key: "storage",
            label: "Stockage",
            status: "incident",
            detail: `Stockage indisponible : ${missing.join(", ")}.`
          }
    );
  }

  if (input.runtime) {
    const runtime = input.runtime;
    if (runtime.truncated || runtime.lastHour >= 3 || runtime.lastDay >= 10) {
      checks.push({
        key: "runtime",
        label: "Erreurs récentes",
        status: "incident",
        detail: runtime.truncated
          ? "Le volume d’erreurs runtime du site dépasse la fenêtre de diagnostic bornée et nécessite une vérification ELTARA."
          : `${runtime.lastHour} erreur(s) runtime sur la dernière heure et ${runtime.lastDay} sur 24 h (${runtime.distinctCodes} type(s)).`
      });
    } else if (runtime.lastHour > 0 || runtime.lastDay >= 3) {
      checks.push({
        key: "runtime",
        label: "Erreurs récentes",
        status: "action",
        detail: `${runtime.lastHour} erreur(s) runtime sur la dernière heure et ${runtime.lastDay} sur 24 h. Le site reste accessible mais la répétition est surveillée.`
      });
    } else {
      checks.push({
        key: "runtime",
        label: "Erreurs récentes",
        status: "healthy",
        detail: runtime.lastDay > 0
          ? `${runtime.lastDay} erreur(s) isolée(s) sur 24 h, sans série récente détectée.`
          : "Aucune erreur runtime récente n’a été enregistrée pour ce site."
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
    repairActions: Array.from(new Set(repairActions)),
    generatedAt: new Date().toISOString()
  };
}
