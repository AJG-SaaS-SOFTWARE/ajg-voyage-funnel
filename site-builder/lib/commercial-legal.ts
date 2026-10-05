import { hostingProvider } from "./site-legal";

function env(name: string) {
  return process.env[name]?.trim() || "";
}

export type CommercialLegalProfile = {
  legalName: string;
  tradeName: string;
  legalForm: string;
  shareCapital: string;
  address: string;
  email: string;
  phone: string;
  siren: string;
  registration: string;
  vatNumber: string;
  publicationDirector: string;
  privacyEmail: string;
  dpoContact: string;
  consumerMediatorName: string;
  consumerMediatorAddress: string;
  consumerMediatorUrl: string;
  consumerSalesEnabled: boolean;
};

export function commercialLegalProfile(): CommercialLegalProfile {
  return {
    legalName: env("AJG_LEGAL_NAME"),
    tradeName: env("AJG_TRADE_NAME") || "ELTARA",
    legalForm: env("AJG_LEGAL_FORM"),
    shareCapital: env("AJG_SHARE_CAPITAL"),
    address: env("AJG_LEGAL_ADDRESS"),
    email: env("AJG_LEGAL_EMAIL"),
    phone: env("AJG_LEGAL_PHONE"),
    siren: env("AJG_SIREN"),
    registration: env("AJG_REGISTRATION"),
    vatNumber: env("AJG_VAT_NUMBER"),
    publicationDirector: env("AJG_PUBLICATION_DIRECTOR"),
    privacyEmail: env("AJG_PRIVACY_EMAIL") || env("AJG_LEGAL_EMAIL"),
    dpoContact: env("AJG_DPO_CONTACT"),
    consumerMediatorName: env("AJG_CONSUMER_MEDIATOR_NAME"),
    consumerMediatorAddress: env("AJG_CONSUMER_MEDIATOR_ADDRESS"),
    consumerMediatorUrl: env("AJG_CONSUMER_MEDIATOR_URL"),
    consumerSalesEnabled:
      env("AJG_COMMERCIAL_CONSUMER_SALES_ENABLED").toLowerCase() === "true"
  };
}

export function commercialLegalMissing(profile = commercialLegalProfile()) {
  const missing: string[] = [];
  if (!profile.legalName) missing.push("dénomination / identité juridique");
  if (!profile.legalForm) missing.push("forme juridique");
  if (!profile.address) missing.push("adresse du siège / établissement");
  if (!profile.email) missing.push("e-mail professionnel");
  if (!profile.phone) missing.push("téléphone professionnel");
  if (!profile.siren) missing.push("SIREN");
  if (!profile.registration) missing.push("immatriculation RNE/RCS");
  if (!profile.publicationDirector) missing.push("directeur de publication");
  if (!profile.privacyEmail) missing.push("contact vie privée");
  if (
    profile.consumerSalesEnabled &&
    (!profile.consumerMediatorName ||
      !profile.consumerMediatorAddress ||
      !profile.consumerMediatorUrl)
  ) {
    missing.push("médiateur de la consommation");
  }
  return missing;
}

export function commercialLegalIsComplete(profile = commercialLegalProfile()) {
  return commercialLegalMissing(profile).length === 0;
}

export { hostingProvider };
