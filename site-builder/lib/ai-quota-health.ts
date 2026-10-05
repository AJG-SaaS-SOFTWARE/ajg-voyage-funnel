import type { SupabaseClient } from "@supabase/supabase-js";

export type AiQuotaSnapshot = {
  planKey: string;
  subscriptionStatus: string;
  betaActive: boolean;
  todayUsed: number;
  dailyLimit: number;
  monthUsed: number;
  monthlyLimit: number;
  heavyMonthUsed: number;
  heavyMonthlyLimit: number;
  launchOperationsRemaining: number;
};

function isActiveBeta(grant: any, nowMs: number) {
  if (!grant?.active) return false;
  const starts = grant.starts_at ? Date.parse(grant.starts_at) : Number.NEGATIVE_INFINITY;
  const expires = grant.expires_at ? Date.parse(grant.expires_at) : Number.POSITIVE_INFINITY;
  return Number.isFinite(starts) && Number.isFinite(expires)
    ? starts <= nowMs && expires > nowMs
    : starts <= nowMs && expires > nowMs;
}

function activePlanStatus(status: string) {
  return ["active", "trialing", "past_due"].includes(status);
}

function heavyPlanStatus(status: string) {
  return ["active", "trialing"].includes(status);
}

export async function getAiQuotaSnapshot(
  service: SupabaseClient,
  userId: string,
  siteId: string,
  now = new Date()
): Promise<AiQuotaSnapshot | null> {
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const nowIso = now.toISOString();

  try {
    const [
      siteSubscriptionResult,
      userSubscriptionResult,
      betaResult,
      todayResult,
      monthResult,
      heavyResult,
      launchResult
    ] = await Promise.all([
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
        .maybeSingle(),
      service
        .from("beta_access_grants")
        .select("active,starts_at,expires_at")
        .eq("user_id", userId)
        .maybeSingle(),
      service
        .from("ai_usage_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", dayStart),
      service
        .from("ai_usage_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", monthStart),
      service
        .from("site_ai_heavy_usage")
        .select("request_id", { count: "exact", head: true })
        .eq("owner_id", userId)
        .gte("created_at", monthStart),
      service
        .from("site_ai_launch_entitlements")
        .select("operations_total,operations_used,status,expires_at")
        .eq("site_id", siteId)
        .eq("owner_id", userId)
        .eq("status", "active")
    ]);

    const failures = [
      siteSubscriptionResult.error,
      userSubscriptionResult.error,
      betaResult.error,
      todayResult.error,
      monthResult.error,
      heavyResult.error,
      launchResult.error
    ].filter(Boolean);
    if (failures.length > 0) return null;

    const betaActive = isActiveBeta(betaResult.data, now.getTime());
    const subscription =
      siteSubscriptionResult.data
      || userSubscriptionResult.data
      || { plan_key: "free", status: "active" };
    const subscriptionStatus = betaActive ? "active" : String(subscription.status || "active");
    const requestedPlanKey = betaActive ? "growth" : String(subscription.plan_key || "free");
    const effectivePlanKey = activePlanStatus(subscriptionStatus) ? requestedPlanKey : "free";

    const { data: plan, error: planError } = await service
      .from("subscription_plans")
      .select("key,ai_daily_limit,ai_monthly_limit,heavy_ai_monthly_limit,active")
      .eq("key", effectivePlanKey)
      .eq("active", true)
      .maybeSingle();

    if (planError || !plan) return null;

    const launchOperationsRemaining = (launchResult.data || []).reduce((sum: number, row: any) => {
      if (row.expires_at && row.expires_at <= nowIso) return sum;
      return sum + Math.max(0, Number(row.operations_total || 0) - Number(row.operations_used || 0));
    }, 0);

    const heavyMonthlyLimit = betaActive
      ? 30
      : requestedPlanKey === "growth" && heavyPlanStatus(subscriptionStatus)
        ? Math.max(0, Number((plan as any).heavy_ai_monthly_limit) || 0)
        : 0;

    return {
      planKey: String((plan as any).key || effectivePlanKey),
      subscriptionStatus,
      betaActive,
      todayUsed: Math.max(0, Number(todayResult.count) || 0),
      dailyLimit: Math.max(0, Number((plan as any).ai_daily_limit) || 0),
      monthUsed: Math.max(0, Number(monthResult.count) || 0),
      monthlyLimit: Math.max(0, Number((plan as any).ai_monthly_limit) || 0),
      heavyMonthUsed: Math.max(0, Number(heavyResult.count) || 0),
      heavyMonthlyLimit,
      launchOperationsRemaining
    };
  } catch {
    return null;
  }
}
