export const AI_PRICING_VERSION = "openai-standard-2026-09-29";

type ModelPrice = {
  inputPerMillionUsd: number;
  cachedInputPerMillionUsd: number;
  outputPerMillionUsd: number;
  longContextInputMultiplier: number;
  longContextOutputMultiplier: number;
};

const DEFAULT_PRICES: Record<string, ModelPrice> = {
  "gpt-5.6-sol": {
    inputPerMillionUsd: 4,
    cachedInputPerMillionUsd: 0.4,
    outputPerMillionUsd: 20,
    longContextInputMultiplier: 2,
    longContextOutputMultiplier: 1.5
  },
  "gpt-5.6-terra": {
    inputPerMillionUsd: 2,
    cachedInputPerMillionUsd: 0.2,
    outputPerMillionUsd: 12,
    longContextInputMultiplier: 2,
    longContextOutputMultiplier: 1.5
  },
  "gpt-5.6-luna": {
    inputPerMillionUsd: 0.2,
    cachedInputPerMillionUsd: 0.02,
    outputPerMillionUsd: 1.2,
    longContextInputMultiplier: 2,
    longContextOutputMultiplier: 1.5
  }
};

function canonicalModel(model: string) {
  const value = model.trim().toLowerCase();
  if (value === "gpt-5.6" || value.startsWith("gpt-5.6-sol")) return "gpt-5.6-sol";
  if (value.startsWith("gpt-5.6-terra")) return "gpt-5.6-terra";
  if (value.startsWith("gpt-5.6-luna")) return "gpt-5.6-luna";
  return "";
}

function positiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function pricingMultiplier() {
  const bps = Number(process.env.OPENAI_PRICE_MULTIPLIER_BPS || "10000");
  if (!Number.isFinite(bps)) return 1;
  return Math.max(0.5, Math.min(3, bps / 10000));
}

export function estimateOpenAiTextCost(args: {
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}) {
  const key = canonicalModel(args.model);
  const price = key ? DEFAULT_PRICES[key] : undefined;
  if (!price) {
    return {
      known: false,
      canonicalModel: key || args.model.trim().toLowerCase() || "unknown",
      pricingVersion: AI_PRICING_VERSION,
      estimatedCostUsdMicros: 0
    };
  }

  const inputTokens = positiveInt(args.inputTokens);
  const cachedInputTokens = Math.min(
    inputTokens,
    positiveInt(args.cachedInputTokens)
  );
  const uncachedInputTokens = inputTokens - cachedInputTokens;
  const outputTokens = positiveInt(args.outputTokens);
  const longContext = inputTokens > 272000;
  const inputMultiplier = longContext ? price.longContextInputMultiplier : 1;
  const outputMultiplier = longContext ? price.longContextOutputMultiplier : 1;
  const accountMultiplier = pricingMultiplier();

  // USD per 1M tokens converts directly to micro-USD per token.
  const micros =
    (
      uncachedInputTokens * price.inputPerMillionUsd * inputMultiplier +
      cachedInputTokens * price.cachedInputPerMillionUsd * inputMultiplier +
      outputTokens * price.outputPerMillionUsd * outputMultiplier
    ) * accountMultiplier;

  return {
    known: true,
    canonicalModel: key,
    pricingVersion: AI_PRICING_VERSION,
    estimatedCostUsdMicros: Math.max(0, Math.round(micros))
  };
}
