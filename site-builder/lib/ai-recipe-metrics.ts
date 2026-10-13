type UsageRow = {
  operation: string;
  duration_ms: number;
  estimated_cost_usd_micros: number;
  pricing_known: boolean;
};
type CostRow = { state: string; charged_micros: number };

function nonnegativeInteger(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("invalid_recipe_cost_metrics");
  }
  return value;
}

// Only aggregate counters; no prompt, output, IDs or customer content are persisted.
export function summarizeAiRecipeMetrics(usage: UsageRow[], costs: CostRow[], elapsedMs: number) {
  if (!costs.length) throw new Error("recipe_provider_costs_missing");
  let settledUsdMicros = 0, uncertainCeilingUsdMicros = 0;
  for (const cost of costs) {
    const amount = nonnegativeInteger(cost.charged_micros);
    if (cost.state === "settled") settledUsdMicros += amount;
    else if (cost.state === "uncertain" || cost.state === "reserved") uncertainCeilingUsdMicros += amount;
    else throw new Error("invalid_recipe_cost_state");
  }
  const providerDurationMs = usage.reduce((sum, row) => sum + nonnegativeInteger(row.duration_ms), 0);
  const estimatedUsageUsdMicros = usage.reduce((sum, row) => sum + nonnegativeInteger(row.estimated_cost_usd_micros), 0);
  return {
    version: 1,
    currency: "USD",
    providerCalls: costs.length,
    recordedUsageCalls: usage.length,
    repairCalls: usage.filter(row => ["standard_repair", "premium_refinement"].includes(row.operation)).length,
    unpricedUsageCalls: usage.filter(row => !row.pricing_known).length,
    settledUsdMicros,
    uncertainCeilingUsdMicros,
    estimatedUsageUsdMicros,
    providerDurationMs,
    elapsedMs: nonnegativeInteger(elapsedMs),
    costBasis: "estimated_provider_usage_not_invoice"
  } as const;
}
