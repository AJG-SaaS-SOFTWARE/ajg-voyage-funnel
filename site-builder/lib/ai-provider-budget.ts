import { estimateAiCostUsdMicros } from "./ai-cost";

export class AiBudgetError extends Error {
  constructor(public code: string) { super(code); }
}

type BudgetContext = {
  service: any;
  userId: string;
  siteId: string;
  requestId: string;
  planKey: string;
  pool: "run" | "launch" | "beta";
  operation: string;
  deadlineAt?: number;
  signal?: AbortSignal;
};

export function providerCostCeiling(body: string, heavy: boolean) {
  let payload: any;
  try { payload = JSON.parse(body); } catch { throw new AiBudgetError("invalid_provider_request"); }
  const output = Number(payload.max_output_tokens);
  if (!Number.isSafeInteger(output) || output < 1 || output > 3000) {
    throw new AiBudgetError("invalid_output_limit");
  }
  const model = String(payload.model || "");
  // Field writing must never silently become a Premium operation through an env override.
  if (!heavy && model !== "gpt-5.6-luna") throw new AiBudgetError("standard_model_not_allowed");
  // UTF-8 bytes deliberately overestimate input tokens; schema and instructions included.
  // Padding covers provider framing. Refuse oversized context before spending.
  const input = Buffer.byteLength(body, "utf8") + 4096;
  if (input > 100_000) throw new AiBudgetError("provider_context_too_large");
  const cost = estimateAiCostUsdMicros(model, {
    inputTokens: input, cachedInputTokens: 0, outputTokens: output
  });
  if (!cost.known || !Number.isSafeInteger(cost.micros)) throw new AiBudgetError("unpriced_model");
  return { ...cost, model };
}

export function createBudgetedProviderFetch(context: BudgetContext, providerFetch: typeof fetch = fetch): typeof fetch {
  let sequence = 0;
  // One deadline for the whole writer pipeline, including repairs and final review.
  const deadlineAt = context.deadlineAt ?? Date.now() + 80_000;
  return async (url, init) => {
    context.signal?.throwIfAborted();
    init?.signal?.throwIfAborted();
    if (Date.now() >= deadlineAt) throw new AiBudgetError("request_time_budget_exhausted");
    if (String(url) !== "https://api.openai.com/v1/responses" || typeof init?.body !== "string") {
      throw new AiBudgetError("invalid_provider_endpoint");
    }
    const heavy = context.operation === "siteArchitect" || context.operation === "siteRevision";
    const ceiling = providerCostCeiling(init.body, heavy);
    const callId = crypto.randomUUID();
    const { data: admission, error } = await context.service.rpc("reserve_ai_provider_budget_with_model", {
      p_call_id: callId, p_request_id: context.requestId,
      p_user_id: context.userId, p_site_id: context.siteId,
      p_plan: context.planKey, p_pool: context.pool,
      p_operation: context.operation, p_sequence: ++sequence,
      p_reserved_micros: ceiling.micros, p_model: ceiling.model
    });
    if (error || admission !== "ok") throw new AiBudgetError(error ? "budget_unavailable" : String(admission));
    let settled = false;
    const settle = async (cost: number | null, state: "settled" | "uncertain") => {
      const { data: settlement, error: settlementError } = await context.service.rpc("settle_ai_provider_budget", {
        p_call_id: callId, p_cost_micros: cost, p_state: state
      });
      if (settlementError || settlement !== true) throw new AiBudgetError("budget_settlement_unavailable");
      settled = true;
    };
    try {
      const remainingMs = deadlineAt - Date.now();
      if (remainingMs <= 0 || context.signal?.aborted || init.signal?.aborted) {
        // Cancellation or admission exhausted the budget before any provider request.
        await settle(0, "settled");
        context.signal?.throwIfAborted();
        init.signal?.throwIfAborted();
        throw new AiBudgetError("request_time_budget_exhausted");
      }
      const response = await providerFetch(url, {
        ...init,
        signal: AbortSignal.any([AbortSignal.timeout(Math.min(70_000, remainingMs)), ...(context.signal ? [context.signal] : []), ...(init.signal ? [init.signal] : [])])
      });
      // Read a clone so existing structured-output and telemetry code keeps its response.
      const data: any = await response.clone().json().catch(() => null);
      const validTokens = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
      const cachedTokens = data?.usage?.input_tokens_details?.cached_tokens ?? 0;
      if (data?.usage && validTokens(data.usage.input_tokens) && validTokens(data.usage.output_tokens) &&
          validTokens(cachedTokens) && cachedTokens <= data.usage.input_tokens &&
          (data.model == null || (typeof data.model === "string" && data.model.trim().length > 0))) {
        const cost = estimateAiCostUsdMicros(data.model ?? ceiling.model, {
          inputTokens: data.usage.input_tokens,
          cachedInputTokens: cachedTokens,
          outputTokens: data.usage.output_tokens
        });
        const known = cost.known && Number.isSafeInteger(cost.micros);
        await settle(known ? cost.micros : null, known ? "settled" : "uncertain");
      } else if (!data?.usage && response.status >= 400 && response.status < 500) {
        await settle(0, "settled");
      } else {
        // Timeout, malformed success or 5xx may have incurred provider spend.
        // Keep the ceiling charged until reconciliation; never pretend it cost zero.
        await settle(null, "uncertain");
      }
      return response;
    } finally {
      if (!settled) {
        await settle(null, "uncertain").catch(() => undefined);
      }
    }
  };
}

