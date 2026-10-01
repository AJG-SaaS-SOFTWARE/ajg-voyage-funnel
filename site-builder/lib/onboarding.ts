import type { SiteConfig } from "./site-config";
import { legalMissingFields } from "./site-legal";

export type OnboardingStepKey = "identity" | "story" | "options" | "review";

export type OnboardingStep = {
  key: OnboardingStepKey;
  complete: boolean;
  labelFr: string;
  labelEn: string;
  detailFr: string;
  detailEn: string;
};

export type OnboardingProgress = {
  percent: number;
  completeCount: number;
  totalCount: number;
  done: boolean;
  nextStep: OnboardingStepKey | null;
  steps: OnboardingStep[];
};

function hasText(value: string, min = 1) {
  return value.trim().length >= min;
}

export function deriveOnboardingProgress(
  config: SiteConfig,
  status: "draft" | "published" | "suspended"
): OnboardingProgress {
  const identityComplete =
    hasText(config.firstName)
    && hasText(config.lastName)
    && hasText(config.brandName)
    && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(config.slug.trim());

  const storyComplete =
    hasText(config.heroTitle, 5)
    && hasText(config.heroSubtitle, 10)
    && hasText(config.aboutText, 20);

  const legalComplete =
    legalMissingFields(config.legal, config.firstName, config.lastName).length === 0;

  const published = status === "published";

  const steps: OnboardingStep[] = [
    {
      key: "identity",
      complete: identityComplete,
      labelFr: "Identité",
      labelEn: "Identity",
      detailFr: identityComplete
        ? "Nom et adresse du site prêts."
        : "Complétez votre identité et l’adresse du site.",
      detailEn: identityComplete
        ? "Website identity and address are ready."
        : "Complete your identity and website address."
    },
    {
      key: "story",
      complete: storyComplete,
      labelFr: "Message",
      labelEn: "Message",
      detailFr: storyComplete
        ? "Les contenus principaux sont renseignés."
        : "Ajoutez un titre, une introduction et votre présentation.",
      detailEn: storyComplete
        ? "Core website copy is filled in."
        : "Add a headline, introduction and about section."
    },
    {
      key: "options",
      complete: legalComplete,
      labelFr: "Informations légales",
      labelEn: "Legal information",
      detailFr: legalComplete
        ? "Les informations requises sont complètes."
        : "Complétez les informations légales avant publication.",
      detailEn: legalComplete
        ? "Required legal information is complete."
        : "Complete the required legal information before publishing."
    },
    {
      key: "review",
      complete: published,
      labelFr: "Publication",
      labelEn: "Publishing",
      detailFr: published
        ? "Le site est publié."
        : "Vérifiez le site puis publiez-le.",
      detailEn: published
        ? "The website is published."
        : "Review the website, then publish it."
    }
  ];

  const completeCount = steps.filter((step) => step.complete).length;
  const next = steps.find((step) => !step.complete) || null;

  return {
    percent: Math.round((completeCount / steps.length) * 100),
    completeCount,
    totalCount: steps.length,
    done: completeCount === steps.length,
    nextStep: next?.key || null,
    steps
  };
}


export type OnboardingCreationPath = {
  mode: "resume" | "ai_available" | "manual";
  showChoice: boolean;
};

export function deriveOnboardingCreationPath(input: {
  progress: OnboardingProgress;
  canCreateWithAi: boolean;
  entitlementActive: boolean;
}): OnboardingCreationPath {
  const storyComplete =
    input.progress.steps.find((step) => step.key === "story")?.complete === true;

  if (input.progress.done || storyComplete) {
    return { mode: "resume", showChoice: false };
  }

  if (input.canCreateWithAi && input.entitlementActive) {
    return { mode: "ai_available", showChoice: true };
  }

  return { mode: "manual", showChoice: true };
}
