import { getSupabaseBrowserClient } from "./supabase-browser";
import { summarizeSiteAnalytics, type AnalyticsOpportunity, type SiteAnalyticsRow } from "./site-analytics";

export type GrowthMetricKey = "page_action_rate" | "form_completion_rate" | "source_concentration";

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
  baselineMetricKey: GrowthMetricKey | null;
  baselineMetricValue: number | null;
  baselineSampleSize: number | null;
  baselineContext: string | null;
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
  metricKey: GrowthMetricKey | "global_action_rate";
  baselineMetricValue: number;
  afterMetricValue: number;
  metricDeltaPoints: number;
  sampleSize: number;
  outcome: "improved" | "stable" | "declined" | null;
};

function key(date: Date) {
  return date.toISOString().slice(0, 10);
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
}

function specificMetric(
  opportunityKey: AnalyticsOpportunity["key"],
  rows: SiteAnalyticsRow[],
  pagePath?: string | null
): { key: GrowthMetricKey; value: number; sampleSize: number; context: string | null } {
  const summary = summarizeSiteAnalytics(rows);

  if (opportunityKey === "cta") {
    const targetPath = pagePath || "/";
    const page = summary.topPages.find((item) => item.pagePath === targetPath);
    return {
      key: "page_action_rate",
      value: page?.actionRate || 0,
      sampleSize: page?.views || 0,
      context: targetPath
    };
  }

  if (opportunityKey === "form") {
    return {
      key: "form_completion_rate",
      value: summary.contactCompletionRate ?? 0,
      sampleSize: summary.formStarts,
      context: null
    };
  }

  const dominantSource = summary.sources[0] || null;
  return {
    key: "source_concentration",
    value: dominantSource ? ratio(dominantSource.views, summary.views) : 0,
    sampleSize: summary.views,
    context: dominantSource?.source || null
  };
}

function minimumSample(metricKey: GrowthMetricKey | "global_action_rate") {
  if (metricKey === "source_concentration") return 20;
  return 5;
}

function outcomeForMetric(
  metricKey: GrowthMetricKey | "global_action_rate",
  deltaPoints: number
): "improved" | "stable" | "declined" {
  const threshold = metricKey === "source_concentration" ? 5 : 1;

  if (metricKey === "source_concentration") {
    return deltaPoints <= -threshold ? "improved" : deltaPoints >= threshold ? "declined" : "stable";
  }

  return deltaPoints >= threshold ? "improved" : deltaPoints <= -threshold ? "declined" : "stable";
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
    baselineMetricKey:
      row.baseline_metric_key === "page_action_rate" ||
      row.baseline_metric_key === "form_completion_rate" ||
      row.baseline_metric_key === "source_concentration"
        ? row.baseline_metric_key
        : null,
    baselineMetricValue: row.baseline_metric_value == null ? null : Number(row.baseline_metric_value),
    baselineSampleSize: row.baseline_sample_size == null ? null : Number(row.baseline_sample_size),
    baselineContext: row.baseline_context || null,
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
  const metric = specificMetric(opportunity.key, baselineRows, opportunity.pagePath);

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
      baseline_action_rate: summary.actionRate,
      baseline_metric_key: metric.key,
      baseline_metric_value: metric.value,
      baseline_sample_size: metric.sampleSize,
      baseline_context: metric.context
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
  const empty = (
    state: GrowthActionMeasurement["state"],
    metricKey: GrowthActionMeasurement["metricKey"] = action.baselineMetricKey || "global_action_rate"
  ): GrowthActionMeasurement => ({
    state,
    windowDays: 0,
    afterViews: 0,
    afterActions: 0,
    afterActionRate: 0,
    actionRatePoints: 0,
    metricKey,
    baselineMetricValue: action.baselineMetricValue ?? action.baselineActionRate,
    afterMetricValue: 0,
    metricDeltaPoints: 0,
    sampleSize: 0,
    outcome: null
  });

  if (action.status === "cancelled") return empty("cancelled");
  if (action.status === "planned" || !action.publishedAt) return empty("planned");

  const publicationDay = new Date(action.publishedAt);
  publicationDay.setUTCHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const fullDays = Math.floor((today.getTime() - publicationDay.getTime()) / 86400000);

  if (fullDays < 3) {
    return { ...empty("collecting"), windowDays: Math.max(0, fullDays) };
  }

  const windowDays = Math.min(action.baselineDays, fullDays);
  const start = new Date(publicationDay);
  start.setUTCDate(start.getUTCDate() + 1);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + (windowDays - 1));
  const afterRows = rows.filter((row) => row.day >= key(start) && row.day <= key(end));
  const after = summarizeSiteAnalytics(afterRows);
  const afterActions = after.ctaClicks + after.formSubmits;

  const metricKey = action.baselineMetricKey || "global_action_rate";
  const baselineMetricValue = action.baselineMetricValue ?? action.baselineActionRate;
  const metric =
    metricKey === "global_action_rate"
      ? { value: after.actionRate, sampleSize: after.views }
      : specificMetric(action.opportunityKey, afterRows, action.baselineContext || action.pagePath);

  const metricDeltaPoints = Math.round((metric.value - baselineMetricValue) * 10) / 10;
  const legacyActionRatePoints = Math.round((after.actionRate - action.baselineActionRate) * 10) / 10;
  const baselineSample = action.baselineSampleSize ?? action.baselineViews;
  const minimum = minimumSample(metricKey);

  if (
    baselineSample < minimum ||
    metric.sampleSize < minimum ||
    (metricKey === "source_concentration" && baselineSample + metric.sampleSize < 40) ||
    (metricKey !== "source_concentration" && baselineSample + metric.sampleSize < 10)
  ) {
    return {
      state: "low_signal",
      windowDays,
      afterViews: after.views,
      afterActions,
      afterActionRate: after.actionRate,
      actionRatePoints: legacyActionRatePoints,
      metricKey,
      baselineMetricValue,
      afterMetricValue: metric.value,
      metricDeltaPoints,
      sampleSize: metric.sampleSize,
      outcome: null
    };
  }

  return {
    state: "measured",
    windowDays,
    afterViews: after.views,
    afterActions,
    afterActionRate: after.actionRate,
    actionRatePoints: legacyActionRatePoints,
    metricKey,
    baselineMetricValue,
    afterMetricValue: metric.value,
    metricDeltaPoints,
    sampleSize: metric.sampleSize,
    outcome: outcomeForMetric(metricKey, metricDeltaPoints)
  };
}
