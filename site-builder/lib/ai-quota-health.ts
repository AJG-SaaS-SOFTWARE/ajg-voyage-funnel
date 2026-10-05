import type { SupabaseClient } from "@supabase/supabase-js";

export type AiQuotaWindow = {
  used: number;
  limit: number;
};

export type AiQuotaHealth = {
  planKey: string;
  planName: string;
  status: "healthy" | "near_limit" | "exhausted" | "unavailable";
  minute: AiQuotaWindow;
  daily: AiQuotaWindow;
  monthly: AiQuotaWindow;
  heavyMonthly?: AiQuotaWindow;
};

type QuotaInput = {
  planKey: string;
  planName: string;
  minuteLimit: number;
  dailyLimit: number;
  monthlyLimit: number;
  minuteUsed: number;
  dailyUsed: number;
  monthlyUsed: number;
  heavyMonthlyLimit?: number;
  heavyMonthlyUsed?: number;
};

function normalized(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function effectiveHeavyAiMonthlyLimit(betaActive: boolean, planLimit: unknown) {
  return betaActive ? 30 : normalized(planLimit);
}

export function deriveAiQuotaHealth(input: QuotaInput): AiQuotaHealth {
  const minute = { used: normalized(input.minuteUsed), limit: normalized(input.minuteLimit) };
  const daily = { used: normalized(input.dailyUsed), limit: normalized(input.dailyLimit) };
  const monthly = { used: normalized(input.monthlyUsed), limit: normalized(input.monthlyLimit) };
  const heavyLimit = normalized(input.heavyMonthlyLimit);
  const heavyUsed = normalized(input.heavyMonthlyUsed);
  const heavyMonthly = heavyLimit > 0 ? { used: heavyUsed, limit: heavyLimit } : undefined;

  const required = [minute.limit, daily.limit, monthly.limit];
  if (required.some((limit) => limit < 1)) {
    return {
      planKey: input.planKey,
      planName: input.planName,
      status: "unavailable",
      minute,
      daily,
      monthly,
      heavyMonthly
    };
  }

  const exhausted =
    minute.used >= minute.limit
    || daily.used >= daily.limit
    || monthly.used >= monthly.limit
    || Boolean(heavyMonthly && heavyMonthly.used >= heavyMonthly.limit);

  const nearLimit =
    daily.used >= daily.limit * 0.9
    || monthly.used >= monthly.limit * 0.9
    || Boolean(heavyMonthly && heavyMonthly.used >= heavyMonthly.limit * 0.9);

  return {
    planKey: input.planKey,
    planName: input.planName,
    status: exhausted ? "exhausted" : nearLimit ? "near_limit" : "healthy",
    minute,
    daily,
    monthly,
    heavyMonthly
  };
}

function startOfUtcDay(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function startOfUtcMonth(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

async function countSince(
  service: SupabaseClient,
  table: "ai_usage_events" | "site_ai_heavy_usage",
  filters: Record<string, string>,
  since: string
) {
  let query = service.from(table).select("*", { count: "exact", head: true }).gte("created_at", since);
  for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

export async function getAiQuotaHealth(
  service: SupabaseClient,
  userId: string,
  siteId: string,
  now = new Date()
): Promise<AiQuotaHealth> {
  const activeAt = now.toISOString();

  const [
    { data: betaGrant, error: betaError },
    { data: siteSubscription, error: siteSubscriptionError },
    { data: userSubscription, error: userSubscriptionError }
  ] = await Promise.all([
    service
      .from("beta_access_grants")
      .select("active,starts_at,expires_at")
      .eq("user_id", userId)
      .eq("active", true)
      .lte("starts_at", activeAt)
      .or(`expires_at.is.null,expires_at.gt.${activeAt}`)
      .maybeSingle(),
    service
      .from("site_subscriptions")
      .select("plan_key,status")
      .eq("site_id", siteId)
      .eq("owner_id", userId)
      .maybeSingle(),
    service
      .from("user_subscriptions")
      .select("plan_key,status")
      .eq("user_id", userId)
      .maybeSingle()
  ]);

  if (betaError || siteSubscriptionError || userSubscriptionError) {
    return deriveAiQuotaHealth({
      planKey: "unknown",
      planName: "Indisponible",
      minuteLimit: 0,
      dailyLimit: 0,
      monthlyLimit: 0,
      minuteUsed: 0,
      dailyUsed: 0,
      monthlyUsed: 0
    });
  }

  const validStatuses = new Set(["active", "trialing", "past_due"]);
  const selected = betaGrant
    ? { plan_key: "growth", status: "active" }
    : siteSubscription || userSubscription || { plan_key: "free", status: "active" };

  const effectivePlanKey = validStatuses.has(String(selected.status))
    ? String(selected.plan_key || "free")
    : "free";

  const { data: plan, error: planError } = await service
    .from("subscription_plans")
    .select("key,name,ai_minute_limit,ai_daily_limit,ai_monthly_limit,heavy_ai_monthly_limit")
    .eq("key", effectivePlanKey)
    .eq("active", true)
    .maybeSingle();

  if (planError || !plan) {
    return deriveAiQuotaHealth({
      planKey: effectivePlanKey,
      planName: "Indisponible",
      minuteLimit: 0,
      dailyLimit: 0,
      monthlyLimit: 0,
      minuteUsed: 0,
      dailyUsed: 0,
      monthlyUsed: 0
    });
  }

  const minuteSince = new Date(now.getTime() - 60_000).toISOString();
  const daySince = startOfUtcDay(now);
  const monthSince = startOfUtcMonth(now);

  const heavyMonthlyLimit = effectiveHeavyAiMonthlyLimit(Boolean(betaGrant), plan.heavy_ai_monthly_limit);

  const [minuteUsed, dailyUsed, monthlyUsed, heavyMonthlyUsed] = await Promise.all([
    countSince(service, "ai_usage_events", { user_id: userId }, minuteSince),
    countSince(service, "ai_usage_events", { user_id: userId }, daySince),
    countSince(service, "ai_usage_events", { user_id: userId }, monthSince),
    heavyMonthlyLimit > 0
      ? countSince(service, "site_ai_heavy_usage", { owner_id: userId, site_id: siteId }, monthSince)
      : Promise.resolve(0)
  ]);

  return deriveAiQuotaHealth({
    planKey: String(plan.key),
    planName: String(plan.name),
    minuteLimit: Number(plan.ai_minute_limit),
    dailyLimit: Number(plan.ai_daily_limit),
    monthlyLimit: Number(plan.ai_monthly_limit),
    minuteUsed,
    dailyUsed,
    monthlyUsed,
    heavyMonthlyLimit,
    heavyMonthlyUsed
  });
}
