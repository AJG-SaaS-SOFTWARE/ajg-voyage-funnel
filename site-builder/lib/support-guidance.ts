import type { SupportCheck } from "./support-diagnostics";

export type SupportGuidance = {
  key: SupportCheck["key"];
  title: string;
  why: string;
  action: string;
  href: string | null;
  cta: string | null;
};

type Locale = "fr" | "en";

const copy: Record<SupportCheck["key"], {
  fr: { title: string; why: string; action: string; href: string | null; cta: string | null };
  en: { title: string; why: string; action: string; href: string | null; cta: string | null };
}> = {
  backend: {
    fr: {
      title: "Service ELTARA",
      why: "Le diagnostic n’arrive pas à confirmer que les services techniques répondent normalement.",
      action: "Réessayez après quelques minutes. Si l’incident persiste, laissez la demande ouverte : aucune action sur votre contenu n’est nécessaire.",
      href: null,
      cta: null
    },
    en: {
      title: "ELTARA service",
      why: "The diagnosis cannot confirm that the technical services are responding normally.",
      action: "Try again after a few minutes. If the issue persists, keep the request open: no change to your content is required.",
      href: null,
      cta: null
    }
  },
  publication: {
    fr: {
      title: "Publication",
      why: "Votre site n’est pas encore dans un état publiable ou son accès public est restreint.",
      action: "Ouvrez ELTARA, terminez les contrôles restants puis republiez.",
      href: "/builder?step=review",
      cta: "Ouvrir la vérification"
    },
    en: {
      title: "Publishing",
      why: "Your website is not yet in a publishable state or public access is restricted.",
      action: "Open ELTARA, complete the remaining checks, then publish again.",
      href: "/builder?step=review",
      cta: "Open review"
    }
  },
  public_render: {
    fr: {
      title: "Site public",
      why: "ELTARA n’obtient pas la réponse HTTP attendue depuis le site publié.",
      action: "Relancez le diagnostic. Si l’échec persiste sans action client proposée, laissez le ticket ouvert pour analyse technique.",
      href: "/support",
      cta: "Relancer le diagnostic"
    },
    en: {
      title: "Public website",
      why: "ELTARA is not receiving the expected HTTP response from the published website.",
      action: "Run the diagnosis again. If it still fails without a suggested customer action, keep the ticket open for technical review.",
      href: "/support",
      cta: "Run diagnosis again"
    }
  },
  latency: {
    fr: {
      title: "Temps de réponse",
      why: "Le site répond, mais plus lentement que le seuil utilisé par le Health Center.",
      action: "Aucune modification éditoriale n’est requise. Relancez le contrôle ; une lenteur persistante sera traitée comme un sujet RUN.",
      href: "/support",
      cta: "Relancer le diagnostic"
    },
    en: {
      title: "Response time",
      why: "The website responds, but slower than the Health Center threshold.",
      action: "No content change is required. Run the check again; persistent slowness will be handled as a RUN issue.",
      href: "/support",
      cta: "Run diagnosis again"
    }
  },
  seo: {
    fr: {
      title: "SEO technique",
      why: "Un élément technique attendu pour l’indexation, comme l’URL canonical, est incomplet.",
      action: "Republiez après le Quality Check. Si l’anomalie reste présente, ELTARA doit la traiter côté moteur.",
      href: "/builder?step=review",
      cta: "Ouvrir le Quality Check"
    },
    en: {
      title: "Technical SEO",
      why: "A technical indexing element, such as the canonical URL, is incomplete.",
      action: "Publish again after the Quality Check. If the issue remains, ELTARA should handle it at engine level.",
      href: "/builder?step=review",
      cta: "Open Quality Check"
    }
  },
  sitemap: {
    fr: {
      title: "Sitemap",
      why: "Le sitemap public ne répond pas ou ne contient pas la structure attendue.",
      action: "Republiez le site puis relancez le diagnostic. Une erreur serveur persistante ne nécessite pas de modifier vos textes.",
      href: "/builder?step=review",
      cta: "Vérifier la publication"
    },
    en: {
      title: "Sitemap",
      why: "The public sitemap does not respond or does not contain the expected structure.",
      action: "Publish the website again, then rerun the diagnosis. A persistent server error does not require changing your copy.",
      href: "/builder?step=review",
      cta: "Check publishing"
    }
  },
  domain: {
    fr: {
      title: "Domaine",
      why: "Le domaine ou sous-domaine n’est pas encore vérifié, correctement relié ou défini comme adresse principale.",
      action: "Ouvrez Domaines et suivez uniquement les enregistrements DNS indiqués par ELTARA.",
      href: "/domains",
      cta: "Ouvrir Domaines"
    },
    en: {
      title: "Domain",
      why: "The domain or subdomain is not yet verified, correctly connected, or set as the primary address.",
      action: "Open Domains and follow only the DNS records shown by ELTARA.",
      href: "/domains",
      cta: "Open Domains"
    }
  },
  billing: {
    fr: {
      title: "Facturation",
      why: "L’état de facturation limite une fonction ou l’accès public du site.",
      action: "Consultez Facturation pour vérifier l’abonnement et le moyen de paiement. ELTARA ne réactive jamais un accès payant depuis le navigateur seul.",
      href: "/billing",
      cta: "Ouvrir Facturation"
    },
    en: {
      title: "Billing",
      why: "The billing state is limiting a feature or public website access.",
      action: "Open Billing to check the subscription and payment method. ELTARA never restores paid access from the browser alone.",
      href: "/billing",
      cta: "Open Billing"
    }
  },
  backup: {
    fr: {
      title: "Sauvegarde",
      why: "La sauvegarde externe n’est pas assez récente ou son état ne peut pas être confirmé.",
      action: "Aucune action sur le site n’est nécessaire. ELTARA doit relancer ou diagnostiquer le job de sauvegarde.",
      href: "/support",
      cta: "Actualiser le diagnostic"
    },
    en: {
      title: "Backup",
      why: "The external backup is not recent enough or its state cannot be confirmed.",
      action: "No website change is required. ELTARA must rerun or diagnose the backup job.",
      href: "/support",
      cta: "Refresh diagnosis"
    }
  },
  ai: {
    fr: {
      title: "Fonctions IA",
      why: "Une limite de quota, un garde-fou global ou une suspension ciblée empêche temporairement une génération.",
      action: "Attendez la réinitialisation indiquée ou consultez votre offre. Le site et l’édition manuelle restent disponibles.",
      href: "/plans",
      cta: "Voir mon offre"
    },
    en: {
      title: "AI features",
      why: "A quota limit, global guardrail, or targeted pause is temporarily preventing generation.",
      action: "Wait for the indicated reset or review your plan. Your website and manual editing remain available.",
      href: "/plans",
      cta: "View my plan"
    }
  },
  contact: {
    fr: {
      title: "Formulaire de contact",
      why: "Le module Contact est activé mais sa configuration n’est pas exploitable.",
      action: "Corrigez l’adresse de réception ou désactivez le module si vous ne souhaitez pas de formulaire, puis republiez.",
      href: "/builder?step=options",
      cta: "Ouvrir les options"
    },
    en: {
      title: "Contact form",
      why: "The Contact module is enabled but its configuration cannot be used.",
      action: "Fix the recipient address or disable the module if you do not want a form, then publish again.",
      href: "/builder?step=options",
      cta: "Open options"
    }
  },
  images: {
    fr: {
      title: "Images et médias",
      why: "Une rubrique active attend un média qui n’est plus disponible ou pas encore publiable.",
      action: "Réimportez le média concerné ou désactivez la rubrique incomplète, puis republiez.",
      href: "/builder?step=design",
      cta: "Ouvrir le design"
    },
    en: {
      title: "Images and media",
      why: "An active section expects media that is no longer available or not yet publishable.",
      action: "Upload the affected media again or disable the incomplete section, then publish again.",
      href: "/builder?step=design",
      cta: "Open design"
    }
  },
  content_links: {
    fr: {
      title: "Liens externes",
      why: "Un lien configuré est invalide, inaccessible ou ne peut pas être vérifié en sécurité.",
      action: "Contrôlez l’adresse du service public concerné, remplacez le lien si nécessaire puis republiez.",
      href: "/builder?step=booking",
      cta: "Vérifier les liens"
    },
    en: {
      title: "External links",
      why: "A configured link is invalid, unreachable, or cannot be checked safely.",
      action: "Check the relevant public service address, replace the link if needed, then publish again.",
      href: "/builder?step=booking",
      cta: "Check links"
    }
  },
  storage: {
    fr: {
      title: "Stockage",
      why: "ELTARA ne peut pas confirmer l’accès à un espace de stockage nécessaire au site.",
      action: "N’importez pas plusieurs fois les mêmes fichiers. Relancez le diagnostic ; si l’incident persiste, il doit être traité côté plateforme.",
      href: "/support",
      cta: "Relancer le diagnostic"
    },
    en: {
      title: "Storage",
      why: "ELTARA cannot confirm access to a storage area required by the website.",
      action: "Do not upload the same files repeatedly. Run the diagnosis again; if it persists, the platform must handle the issue.",
      href: "/support",
      cta: "Run diagnosis again"
    }
  }
};

export function supportGuidanceForCheck(check: SupportCheck, locale: Locale): SupportGuidance | null {
  if (check.status === "healthy") return null;
  const entry = copy[check.key]?.[locale] || copy[check.key]?.fr;
  if (!entry) return null;
  return { key: check.key, ...entry };
}

export function supportGuidanceForDiagnosis(checks: SupportCheck[], locale: Locale): SupportGuidance[] {
  return checks
    .filter((check) => check.status !== "healthy")
    .map((check) => supportGuidanceForCheck(check, locale))
    .filter((item): item is SupportGuidance => Boolean(item))
    .slice(0, 4);
}


export type SupportCheckDisplay = {
  title: string;
  detail: string;
  action: string | null;
};

export function supportCheckDisplay(
  check: SupportCheck,
  locale: Locale
): SupportCheckDisplay {
  if (locale === "fr") {
    return {
      title: check.label,
      detail: check.detail,
      action: check.clientAction || null
    };
  }

  const entry = copy[check.key]?.en;
  if (!entry) {
    return {
      title: "Technical check",
      detail:
        check.status === "healthy"
          ? "No issue detected by this check."
          : check.status === "action"
            ? "An action is recommended for this check."
            : "A technical incident was detected by this check.",
      action: null
    };
  }

  return {
    title: entry.title,
    detail:
      check.status === "healthy"
        ? "No issue detected by this check."
        : entry.why,
    action: check.status === "healthy" ? null : entry.action
  };
}

const ticketStatusCopy: Record<string, { fr: string; en: string }> = {
  diagnosed: { fr: "Diagnostic effectué", en: "Diagnosed" },
  waiting_customer: { fr: "Action requise", en: "Action required" },
  in_progress: { fr: "En cours", en: "In progress" },
  resolved: { fr: "Résolu", en: "Resolved" },
  closed: { fr: "Fermé", en: "Closed" }
};

export function supportTicketStatusLabel(status: string, locale: Locale) {
  return ticketStatusCopy[status]?.[locale] || (locale === "en" ? "In review" : "En cours de traitement");
}
