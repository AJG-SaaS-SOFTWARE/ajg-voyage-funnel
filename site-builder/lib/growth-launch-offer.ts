// Server-only commercial gate. Enable only after observed beta profitability approval.
export function growthAnnualIncludesLaunch() {
  return process.env.AJG_GROWTH_ANNUAL_INCLUDES_AI_LAUNCH?.trim().toLowerCase() === "true";
}
