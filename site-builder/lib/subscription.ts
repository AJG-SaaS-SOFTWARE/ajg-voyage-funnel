import { getSupabaseBrowserClient } from "./supabase-browser";

export type SubscriptionEntitlements = {
  planKey: "free" | "pro";
  planName: string;
  aiMinuteLimit: number;
  aiDailyLimit: number;
  aiMonthlyLimit: number;
  storageMb: number;
  customDomain: boolean;
  premiumArchitect: boolean;
  status: string;
};

export const freeEntitlements: SubscriptionEntitlements = {
  planKey: "free",
  planName: "Gratuit",
  aiMinuteLimit: 5,
  aiDailyLimit: 20,
  aiMonthlyLimit: 80,
  storageMb: 250,
  customDomain: false,
  premiumArchitect: false,
  status: "active"
};

export async function getMyEntitlements(): Promise<SubscriptionEntitlements> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return freeEntitlements;
  const { data, error } = await supabase.rpc("get_my_entitlements");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return freeEntitlements;
  return {
    planKey: row.plan_key === "pro" ? "pro" : "free",
    planName: row.plan_name || "Gratuit",
    aiMinuteLimit: Number(row.ai_minute_limit) || 5,
    aiDailyLimit: Number(row.ai_daily_limit) || 20,
    aiMonthlyLimit: Number(row.ai_monthly_limit) || 80,
    storageMb: Number(row.storage_mb) || 250,
    customDomain: row.custom_domain === true,
    premiumArchitect: row.premium_architect === true,
    status: row.subscription_status || "active"
  };
}

export async function getMySiteEntitlements(siteId: string): Promise<SubscriptionEntitlements> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return freeEntitlements;
  const { data, error } = await supabase.rpc("get_my_site_entitlements", { p_site_id: siteId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return freeEntitlements;
  return {
    planKey: row.plan_key === "pro" ? "pro" : "free",
    planName: row.plan_name || "Gratuit",
    aiMinuteLimit: Number(row.ai_minute_limit) || 5,
    aiDailyLimit: Number(row.ai_daily_limit) || 20,
    aiMonthlyLimit: Number(row.ai_monthly_limit) || 80,
    storageMb: Number(row.storage_mb) || 250,
    customDomain: row.custom_domain === true,
    premiumArchitect: row.premium_architect === true,
    status: row.subscription_status || "active"
  };
}

export type AiUsage = { today: number; month: number };

export async function getMyAiUsage(): Promise<AiUsage> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { today: 0, month: 0 };
  const { data, error } = await supabase.rpc("get_my_ai_usage");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { today: Number(row?.today) || 0, month: Number(row?.month) || 0 };
}

export type StorageUsage = { usedBytes: number; limitMb: number };

export async function getMyStorageUsage(): Promise<StorageUsage> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { usedBytes: 0, limitMb: freeEntitlements.storageMb };
  const { data, error } = await supabase.rpc("get_my_storage_usage");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { usedBytes: Number(row?.used_bytes) || 0, limitMb: Number(row?.storage_limit_mb) || freeEntitlements.storageMb };
}
