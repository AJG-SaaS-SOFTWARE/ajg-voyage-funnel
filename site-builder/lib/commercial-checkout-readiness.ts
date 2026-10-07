import {
  commercialLegalMissing,
  commercialLegalProfile
} from "./commercial-legal";
import {
  auditStripeRuntimeCached,
  type StripeRuntimeAuditItem
} from "./stripe-readiness";

function enabled(name: string) {
  return process.env[name]?.trim().toLowerCase() === "true";
}

function present(name: string) {
  return Boolean(process.env[name]?.trim());
}

export type CommercialConfigurationReadiness = {
  ok: boolean;
  legal: {
    ok: boolean;
    approved: boolean;
    missing: string[];
  };
  tax: {
    ok: boolean;
    approved: boolean;
    market: string;
    vatRegime: string;
    stripeTaxEnabled: boolean;
    taxCode: string;
    reason: string;
  };
  stripe: {
    ok: boolean;
    missing: string[];
  };
  reasons: string[];
};

export function commercialConfigurationReadiness(): CommercialConfigurationReadiness {
  const profile = commercialLegalProfile();
  const legalMissing = commercialLegalMissing(profile);
  const legalApproved = enabled("AJG_COMMERCIAL_LEGAL_READY");
  const legalOk = legalApproved && legalMissing.length === 0;

  const taxApproved = enabled("AJG_COMMERCIAL_TAX_READY");
  const market = process.env.AJG_COMMERCIAL_MARKET?.trim().toUpperCase() || "B2B";
  const vatRegime =
    process.env.AJG_VAT_REGIME?.trim().toLowerCase() || "unconfirmed";
  const stripeTaxEnabled = enabled("AJG_STRIPE_TAX_ENABLED");
  const taxCode = process.env.AJG_STRIPE_TAX_CODE?.trim() || "";
  const vatNumber = process.env.AJG_VAT_NUMBER?.trim() || "";

  const taxConfigurationValid =
    market === "B2B" &&
    taxCode === "txcd_10103001" &&
    (
      (vatRegime === "franchise_base" && !stripeTaxEnabled) ||
      (vatRegime === "vat_registered" && stripeTaxEnabled && Boolean(vatNumber))
    );

  let taxReason = "Configuration fiscale prête.";
  if (!taxApproved) {
    taxReason = "Validation fiscale non approuvée.";
  } else if (market !== "B2B") {
    taxReason = "Le lancement commercial ELTARA est actuellement limité au B2B.";
  } else if (taxCode !== "txcd_10103001") {
    taxReason = "Tax code SaaS Business Use invalide.";
  } else if (vatRegime === "unconfirmed") {
    taxReason = "Régime TVA non confirmé.";
  } else if (vatRegime === "franchise_base" && stripeTaxEnabled) {
    taxReason = "Stripe Tax doit rester désactivé sous franchise en base.";
  } else if (vatRegime === "vat_registered" && !stripeTaxEnabled) {
    taxReason = "Stripe Tax doit être activé pour le régime TVA collectée.";
  } else if (vatRegime === "vat_registered" && !vatNumber) {
    taxReason = "Numéro de TVA intracommunautaire manquant.";
  } else if (!taxConfigurationValid) {
    taxReason = "Configuration fiscale incohérente.";
  }

  const stripeRequirements = [
    "STRIPE_RESTRICTED_KEY|STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_ESSENTIAL_MONTHLY_PRICE_ID",
    "STRIPE_ESSENTIAL_ANNUAL_PRICE_ID",
    "STRIPE_GROWTH_MONTHLY_PRICE_ID",
    "STRIPE_GROWTH_ANNUAL_PRICE_ID",
    "STRIPE_AI_LAUNCH_PRICE_ID",
    "STRIPE_PORTAL_CONFIGURATION_ID"
  ];

  const stripeMissing = stripeRequirements.filter((requirement) => {
    if (requirement.includes("|")) {
      return !requirement.split("|").some((name) => present(name));
    }
    return !present(requirement);
  });
  const stripeOk = stripeMissing.length === 0;

  const reasons: string[] = [];
  if (!legalOk) {
    reasons.push(
      !legalApproved
        ? "Validation juridique non approuvée."
        : `Identité juridique incomplète : ${legalMissing.join(", ")}.`
    );
  }
  if (!taxApproved || !taxConfigurationValid) reasons.push(taxReason);
  if (!stripeOk) {
    reasons.push(`Configuration Stripe incomplète : ${stripeMissing.join(", ")}.`);
  }

  return {
    ok: legalOk && taxApproved && taxConfigurationValid && stripeOk,
    legal: {
      ok: legalOk,
      approved: legalApproved,
      missing: legalMissing
    },
    tax: {
      ok: taxApproved && taxConfigurationValid,
      approved: taxApproved,
      market,
      vatRegime,
      stripeTaxEnabled,
      taxCode,
      reason: taxReason
    },
    stripe: {
      ok: stripeOk,
      missing: stripeMissing
    },
    reasons
  };
}

export type CommercialCheckoutReadiness = {
  ok: boolean;
  reasons: string[];
  stripeAudit: StripeRuntimeAuditItem[];
};

export async function commercialCheckoutReadiness(): Promise<CommercialCheckoutReadiness> {
  const config = commercialConfigurationReadiness();
  if (!config.ok) {
    return {
      ok: false,
      reasons: config.reasons,
      stripeAudit: []
    };
  }

  let stripeAudit: StripeRuntimeAuditItem[];
  try {
    stripeAudit = await auditStripeRuntimeCached();
  } catch {
    return {
      ok: false,
      reasons: ["Audit distant Stripe indisponible."],
      stripeAudit: []
    };
  }

  const failures = stripeAudit.filter((item) => !item.ok);
  return {
    ok: failures.length === 0,
    reasons: failures.map((item) => item.detail),
    stripeAudit
  };
}
