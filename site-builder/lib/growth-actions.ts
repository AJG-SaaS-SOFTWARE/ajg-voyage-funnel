import { getSupabaseBrowserClient } from "./supabase-browser";
import { summarizeSiteAnalytics, type AnalyticsOpportunity, type SiteAnalyticsRow } from "./site-analytics";

export type GrowthAction = {
  id: string;
  siteId: string;
  opportunityKey: AnalyticsOpportunity["key"];
  pagePath: string | null;
  score: number;
  impact: AnalyticsOpportunity["impact"];
  confidence: AnalyticsOpportunity["confidence"];
  baselineDays: number;
  baselineStart: string;
  baselineEnd: string;
  baselineViews: number;
  baselineActions: number;
  baselineActionRate: number;
  status: "planned" | "published" | "cancelled";
  startedAt: string;
  publishedAt: string | null;
  createdAt: string;
};

export type GrowthActionMeasurement = {
  state: "planned" | "collecting" | "low_signal" | "measured" | "cancelled";
  windowDays: number;
  afterViews: number;
  afterActions: number;
  afterActionRate: number;
  actionRatePoints: number;
  outcome: "improved" | "stable" | "declined" | null;
};

function key(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toAction(row: any): GrowthAction {
  return {
    id: row.id,
    siteId: row.site_id,
    opportunityKey: row.opportunity_key,
    pagePath: row.page_path || null,
    score: Number(row.score || 0),
    impact: row.impact,
    confidence: row.confidence,
    baselineDays: Number(row.baseline_days || 30),
    baselineStart: row.baseline_start,
    baselineEnd: row.baseline_end,
    baselineViews: Number(row.baseline_views || 0),
    baselineActions: Number(row.baseline_actions || 0),
    baselineActionRate: Number(row.baseline_action_rate || 0),
    status: row.status,
    startedAt: row.started_at,
    publishedAt: row.published_at || null,
    createdAt: row.created_at
  };
}

export async function getMyGrowthActions(siteId: string): Promise<GrowthAction[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await (supabase as any)
    .from("site_growth_actions")
    .select("*")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data || []).map(toAction);
}

export async function startGrowthAction(
  siteId: string,
  opportunity: AnalyticsOpportunity,
  rows: SiteAnalyticsRow[],
  baselineDays = 30
): Promise<GrowthAction> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const user = authData.user;
  if (!user) throw new Error("Authentication required.");

  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (baselineDays - 1));
  const baselineRows = rows.filter((row) => row.day >= key(start) && row.day <= key(end));
  const summary = summarizeSiteAnalytics(baselineRows);

  const { error: cancelError } = await (supabase as any)
    .from("site_growth_actions")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("site_id", siteId)
    .eq("status", "planned");
  if (cancelError) throw cancelError;

  const { data, error } = await (supabase as any)
    .from("site_growth_actions")
    .insert({
      site_id: siteId,
      owner_id: user.id,
      opportunity_key: opportunity.key,
      page_path: opportunity.pagePath || null,
      score: opportunity.score,
      impact: opportunity.impact,
      confidence: opportunity.confidence,
      baseline_days: baselineDays,
      baseline_start: key(start),
      baseline_end: key(end),
      baseline_views: summary.views,
      baseline_actions: summary.ctaClicks + summary.formSubmits,
      baseline_action_rate: summary.actionRate
    })
    .select("*")
    .single();
  if (error) throw error;
  return toAction(data);
}

export async function markGrowthActionPublished(actionId: string, siteId: string, publishedAt: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  const { error } = await (supabase as any)
    .from("site_growth_actions")
    .update({ status: "published", published_at: publishedAt, updated_at: new Date().toISOString() })
    .eq("id", actionId)
    .eq("site_id", siteId)
    .eq("status", "planned");
  if (error) throw error;
}

export function measureGrowthAction(
  action: GrowthAction,
  rows: SiteAnalyticsRow[],
  now = new Date()
): GrowthActionMeasurement {
  if (action.status === "cancelled") {
    return { state: "cancelled", windowDays: 0, afterViews: 0, afterActions: 0, afterActionRate: 0, actionRatePoints: 0, outcome: null };
  }
  if (action.status === "planned" || !action.publishedAt) {
    return { state: "planned", windowDays: 0, afterViews: 0, afterActions: 0, afterActionRate: 0, actionRatePoints: 0, outcome: null };
  }

  const publicationDay = new Date(action.publishedAt);
  publicationDay.setUTCHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const fullDays = Math.floor((today.getTime() - publicationDay.getTime()) / 86400000);
  if (fullDays < 3) {
    return { state: "collecting", windowDays: Math.max(0, fullDays), afterViews: 0, afterActions: 0, afterActionRate: 0, actionRatePoints: 0, outcome: null };
  }

  const windowDays = Math.min(action.baselineDays, fullDays);
  const start = new Date(publicationDay);
  start.setUTCDate(start.getUTCDate() + 1);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + (windowDays - 1));
  const after = summarizeSiteAnalytics(rows.filter((row) => row.day >= key(start) && row.day <= key(end)));
  const afterActions = after.ctaClicks + after.formSubmits;
  const actionRatePoints = Math.round((after.actionRate - action.baselineActionRate) * 10) / 10;

  if (action.baselineViews < 5 || after.views < 5 || action.baselineViews + after.views < 20) {
    return { state: "low_signal", windowDays, afterViews: after.views, afterActions, afterActionRate: after.actionRate, actionRatePoints, outcome: null };
  }

  const outcome = actionRatePoints >= 1 ? "improved" : actionRatePoints <= -1 ? "declined" : "stable";
  return { state: "measured", windowDays, afterViews: after.views, afterActions, afterActionRate: after.actionRate, actionRatePoints, outcome };
}
