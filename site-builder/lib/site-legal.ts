export type PublisherType = "individual" | "company";
export type ActivityKind = "commercial" | "artisan" | "liberal" | "other";

export type SiteLegalConfig = {
  publisherType: PublisherType;
  activityKind: ActivityKind;
  legalName: string;
  tradeName: string;
  legalForm: string;
  shareCapital: string;
  address: string;
  email: string;
  phone: string;
  siren: string;
  registrationDetails: string;
  vatNumber: string;
  publicationDirector: string;
  regulatedActivity: boolean;
  professionalTitle: string;
  professionalBody: string;
  authorizationAuthority: string;
  professionalRules: string;
  privacyEmail: string;
  dpoContact: string;
  additionalLegalNote: string;
  confirmedAccuracy: boolean;
};

export const defaultSiteLegalConfig: SiteLegalConfig = {
  publisherType: "individual",
  activityKind: "other",
  legalName: "",
  tradeName: "",
  legalForm: "",
  shareCapital: "",
  address: "",
  email: "",
  phone: "",
  siren: "",
  registrationDetails: "",
  vatNumber: "",
  publicationDirector: "",
  regulatedActivity: false,
  professionalTitle: "",
  professionalBody: "",
  authorizationAuthority: "",
  professionalRules: "",
  privacyEmail: "",
  dpoContact: "",
  additionalLegalNote: "",
  confirmedAccuracy: false
};

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function normalizeSiteLegalConfig(value: unknown): SiteLegalConfig {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    publisherType: input.publisherType === "company" ? "company" : "individual",
    activityKind: ["commercial", "artisan", "liberal", "other"].includes(String(input.activityKind))
      ? input.activityKind as ActivityKind
      : "other",
    legalName: text(input.legalName, 180),
    tradeName: text(input.tradeName, 180),
    legalForm: text(input.legalForm, 100),
    shareCapital: text(input.shareCapital, 80),
    address: text(input.address, 360),
    email: text(input.email, 254),
    phone: text(input.phone, 80),
    siren: text(input.siren, 40),
    registrationDetails: text(input.registrationDetails, 220),
    vatNumber: text(input.vatNumber, 60),
    publicationDirector: text(input.publicationDirector, 180),
    regulatedActivity: input.regulatedActivity === true,
    professionalTitle: text(input.professionalTitle, 180),
    professionalBody: text(input.professionalBody, 220),
    authorizationAuthority: text(input.authorizationAuthority, 220),
    professionalRules: text(input.professionalRules, 500),
    privacyEmail: text(input.privacyEmail, 254),
    dpoContact: text(input.dpoContact, 254),
    additionalLegalNote: text(input.additionalLegalNote, 1200),
    confirmedAccuracy: input.confirmedAccuracy === true
  };
}

export const hostingProvider = {
  name: "Vercel Inc.",
  address: "440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis",
  phone: "+1 559 288 7060",
  website: "https://vercel.com"
} as const;

export function effectivePublisherName(legal: SiteLegalConfig, firstName: string, lastName: string) {
  return legal.legalName || (legal.publisherType === "individual" ? `${firstName} ${lastName}`.trim() : "");
}

export function effectivePublicationDirector(legal: SiteLegalConfig, firstName: string, lastName: string) {
  return legal.publicationDirector || (legal.publisherType === "individual" ? effectivePublisherName(legal, firstName, lastName) : "");
}

export function effectivePrivacyEmail(legal: SiteLegalConfig) {
  return legal.privacyEmail || legal.email;
}

export function legalMissingFields(legal: SiteLegalConfig, firstName: string, lastName: string) {
  const missing: string[] = [];
  if (!effectivePublisherName(legal, firstName, lastName)) missing.push("identité de l’éditeur");
  if (!legal.address) missing.push("adresse professionnelle ou siège");
  if (!legal.email) missing.push("e-mail professionnel");
  if (!legal.phone) missing.push("téléphone professionnel");
  if (!legal.siren) missing.push("SIREN");
  if (!effectivePublicationDirector(legal, firstName, lastName)) missing.push("directeur de publication");
  if (!effectivePrivacyEmail(legal)) missing.push("contact RGPD");
  if (legal.publisherType === "company" && !legal.legalForm) missing.push("forme juridique");
  if (legal.publisherType === "company" && !legal.shareCapital) missing.push("capital social");
  if (["commercial", "artisan"].includes(legal.activityKind) && !legal.registrationDetails) {
    missing.push(legal.activityKind === "commercial" ? "immatriculation RCS / RNE" : "immatriculation RNE");
  }
  if (legal.regulatedActivity) {
    if (!legal.professionalTitle) missing.push("titre professionnel");
    if (!legal.professionalBody && !legal.authorizationAuthority) missing.push("ordre, organisme ou autorité compétente");
    if (!legal.professionalRules) missing.push("règles professionnelles applicables");
  }
  if (!legal.confirmedAccuracy) missing.push("confirmation des informations légales");
  return missing;
}

export function legalIsComplete(legal: SiteLegalConfig, firstName: string, lastName: string) {
  return legalMissingFields(legal, firstName, lastName).length === 0;
}
