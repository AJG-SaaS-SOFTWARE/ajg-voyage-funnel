/**
 * Pure, deterministic monthly contribution model for ELTARA.
 * All monetary amounts are integer EUR cents, revenue excludes VAT.
 * Supplier USD micro-costs require an explicitly dated USD->EUR rate.
 * This is reporting, NOT a replacement for atomic provider admission.
 */
export type SiteMonthCost = {
  revenueExVatCents: number;
  paymentFeesCents: number;
  hostingCents: number;
  storageCents: number;
  bandwidthCents: number;
  backupsCents: number;
  mediaCents: number;
  emailCents: number;
  domainCents: number;
  observabilityCents: number;
  otherCents: number;
  aiUsdMicros: number;
  aiUncertainUsdMicros: number;
};
export type FxRate = { usdToEur: number; effectiveDate: string; source: string };
export type UnitEconomics = {
  costCents: number;
  aiCostCents: number;
  unresolvedAiProvisionCents: number;
  contributionCents: number;
  marginPercent: number | null;
  meets80PercentTarget: boolean;
  status: "profitable" | "below_target" | "no_revenue";
  fxDate: string;
  estimated: true;
};
function validCents(n: number, field: string) {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error("invalid_" + field);
  return n;
}
function usdMicrosInEurCents(usdMicros: number, rate: number) {
  validCents(usdMicros, "usd_micros");
  const converted = Math.ceil(usdMicros / 10_000 * rate);
  if (!Number.isSafeInteger(converted)) throw new Error("invalid_conversion");
  return converted;
}
export function calculateSiteMonthEconomics(input: SiteMonthCost, fx: FxRate): UnitEconomics {
  if (!Number.isFinite(fx.usdToEur) || fx.usdToEur <= 0 ||
      !/^20\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(fx.effectiveDate) ||
      Number.isNaN(Date.parse(fx.effectiveDate + "T00:00:00Z")) ||\n      new Date(fx.effectiveDate + "T00:00:00Z").toISOString().slice(0, 10) !== fx.effectiveDate ||\n      !fx.source.trim()) {
    throw new Error("invalid_fx_rate");
  }
  const fields = ["revenueExVatCents","paymentFeesCents","hostingCents","storageCents",
    "bandwidthCents","backupsCents","mediaCents","emailCents","domainCents",
    "observabilityCents","otherCents"] as const;
  for (const field of fields) validCents(input[field], field);
  const aiCostCents = usdMicrosInEurCents(input.aiUsdMicros, fx.usdToEur);
  const unresolvedAiProvisionCents = usdMicrosInEurCents(input.aiUncertainUsdMicros, fx.usdToEur);
  const costCents = fields.filter(f => f !== "revenueExVatCents")
    .reduce((sum, field) => sum + input[field], aiCostCents + unresolvedAiProvisionCents);
  if (!Number.isSafeInteger(costCents)) throw new Error("invalid_total_cost");
  const contributionCents = input.revenueExVatCents - costCents;
  const marginPercent = input.revenueExVatCents === 0 ? null :
    100 * contributionCents / input.revenueExVatCents;
  return {
    costCents, aiCostCents, unresolvedAiProvisionCents, contributionCents, marginPercent,
    meets80PercentTarget: marginPercent !== null && marginPercent >= 80,
    status: marginPercent === null ? "no_revenue" : marginPercent >= 80 ? "profitable" : "below_target",
    fxDate: fx.effectiveDate, estimated: true
  };
}


/** Admission policy for costly site operations; never use as a public hosting entitlement. */
export function siteCostRiskDecision(input: {
  subscriptionActive: boolean;
  operation: "ai" | "publish" | "edit" | "media_upload";
  forecastMarginPercent: number | null;
  providerSpendUncertain: boolean;
}): "allow" | "subscription_required" | "review_costs" | "budget_risk" {
  if (!input.subscriptionActive && (input.operation === "publish" || input.operation === "media_upload"))
    return "subscription_required";
  // Editing an existing draft should remain possible even if reports are unavailable.
  if (input.operation === "edit") return "allow";
  if (input.providerSpendUncertain && input.operation === "ai") return "review_costs";
  if (input.operation === "ai" && (input.forecastMarginPercent === null ||
      !Number.isFinite(input.forecastMarginPercent))) return "review_costs";
  if (input.operation === "ai" && input.forecastMarginPercent! < 80) return "budget_risk";
  return "allow";
}
