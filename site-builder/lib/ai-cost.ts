export const AI_COST_PRICING_VERSION = "openai-2026-09-29-standard-short";

type AiUsageForCost = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
};

type ModelRate = {
  inputUsdPerMillion: number;
  cachedInputUsdPerMillion: number;
  outputUsdPerMillion: number;
  longInputUsdPerMillion: number;
  longCachedInputUsdPerMillion: number;
  longOutputUsdPerMillion: number;
};

const rates: Record<string, ModelRate> = {
  "gpt-5.6": {
    inputUsdPerMillion: 4,
    cachedInputUsdPerMillion: 0.4,
    outputUsdPerMillion: 20,
    longInputUsdPerMillion: 8,
    longCachedInputUsdPerMillion: 0.8,
    longOutputUsdPerMillion: 30
  },
  "gpt-5.6-sol": {
    inputUsdPerMillion: 4,
    cachedInputUsdPerMillion: 0.4,
    outputUsdPerMillion: 20,
    longInputUsdPerMillion: 8,
    longCachedInputUsdPerMillion: 0.8,
    longOutputUsdPerMillion: 30
  },
  "gpt-5.6-terra": {
    inputUsdPerMillion: 2,
    cachedInputUsdPerMillion: 0.2,
    outputUsdPerMillion: 12,
    longInputUsdPerMillion: 4,
    longCachedInputUsdPerMillion: 0.4,
    longOutputUsdPerMillion: 18
  },
  "gpt-5.6-luna": {
    inputUsdPerMillion: 0.2,
    cachedInputUsdPerMillion: 0.02,
    outputUsdPerMillion: 1.2,
    longInputUsdPerMillion: 0.4,
    longCachedInputUsdPerMillion: 0.04,
    longOutputUsdPerMillion: 1.8
  }
};

function normalizedModel(model: string) {
  return model.trim().toLowerCase();
}

export function estimateAiCostUsdMicros(
  model: string,
  usage: AiUsageForCost
): { micros: number; known: boolean; pricingVersion: string } {
  const rate = rates[normalizedModel(model)];
  if (!rate) {
    return { micros: 0, known: false, pricingVersion: AI_COST_PRICING_VERSION };
  }

  const input = Math.max(0, Math.round(usage.inputTokens || 0));
  const cached = Math.min(input, Math.max(0, Math.round(usage.cachedInputTokens || 0)));
  const uncached = Math.max(0, input - cached);
  const output = Math.max(0, Math.round(usage.outputTokens || 0));
  const longContext = input > 272_000;

  const inputRate = longContext ? rate.longInputUsdPerMillion : rate.inputUsdPerMillion;
  const cachedRate = longContext
    ? rate.longCachedInputUsdPerMillion
    : rate.cachedInputUsdPerMillion;
  const outputRate = longContext
    ? rate.longOutputUsdPerMillion
    : rate.outputUsdPerMillion;

  // USD per million tokens is numerically micro-USD per token.
  const micros = Math.max(
    0,
    Math.round(uncached * inputRate + cached * cachedRate + output * outputRate)
  );

  return { micros, known: true, pricingVersion: AI_COST_PRICING_VERSION };
}
