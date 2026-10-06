import { getSupabaseBrowserClient } from "./supabase-browser";
import { getCurrentUser } from "./supabase-site-repository";

export type SiteAnalyticsEventName = "page_view" | "cta_click" | "form_start" | "form_submit";
export type SiteAnalyticsSource = "direct" | "internal" | "search" | "social" | "referral" | "other";
export type AnalyticsPeriodDays = 7 | 30 | 90;

export type SiteAnalyticsRow = {
  day: string;
  eventName: SiteAnalyticsEventName;
  pagePath: string;
  source: SiteAnalyticsSource;
  eventLabel: string;
  count: number;
};

export type AnalyticsOpportunity = {
  key: "cta" | "form" | "acquisition";
  priority: "high" | "medium";
  impact: "high" | "medium";
  confidence: "high" | "medium";
  score: number;
  evidenceCount: number;
  pagePath?: string;
  value: number;
};

export type PostPublishPerformance = {
  status: "no_marker" | "collecting" | "low_signal" | "measured";
  windowDays: number;
  before: SiteAnalyticsSummary | null;
  after: SiteAnalyticsSummary | null;
  actionRatePoints: number;
  outcome: "improved" | "stable" | "declined" | null;
};

export type SiteAnalyticsSummary = {
  views: number;
  ctaClicks: number;
  formStarts: number;
  formSubmits: number;
  actionRate: number;
  contactCompletionRate: number | null;
  topPages: Array<{
    pagePath: string;
    views: number;
    ctaClicks: number;
    formSubmits: number;
    actionRate: number;
  }>;
  sources: Array<{ source: SiteAnalyticsSource; views: number }>;
  ctas: Array<{ label: string; clicks: number }>;
  opportunities: AnalyticsOpportunity[];
};

export type AnalyticsComparison = {
  current: SiteAnalyticsSummary;
  previous: SiteAnalyticsSummary;
  periodDays: AnalyticsPeriodDays;
  deltas: {
    views: number | null;
    ctaClicks: number | null;
    formSubmits: number | null;
    actionRatePoints: number;
  };
};

export async function getMySiteAnalytics(siteId: string, days = 180): Promise<SiteAnalyticsRow[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const user = await getCurrentUser();
  if (!user) return [];

  const safeDays = Math.min(180, Math.max(7, Math.round(days)));
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (safeDays - 1));
  const sinceDay = since.toISOString().slice(0, 10);

  const analyticsClient = supabase as any;
  const { data, error } = await analyticsClient
    .from("site_analytics_daily")
    .select("day,event_name,page_path,source,event_label,event_count")
    .eq("site_id", siteId)
    .gte("day", sinceDay)
    .order("day", { ascending: true });

  if (error) throw error;
  return (data || []).map((row: any) => ({
    day: String(row.day),
    eventName: row.event_name as SiteAnalyticsEventName,
    pagePath: String(row.page_path || "/"),
    source: row.source as SiteAnalyticsSource,
    eventLabel: String(row.event_label || ""),
    count: Math.max(0, Number(row.event_count) || 0)
  }));
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
}

function deltaPercent(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? null : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function summarizeSiteAnalytics(rows: SiteAnalyticsRow[]): SiteAnalyticsSummary {
  const byPage = new Map<string, { views: number; ctaClicks: number; formSubmits: number }>();
  const bySource = new Map<SiteAnalyticsSource, number>();
  const byCta = new Map<string, number>();

  let views = 0;
  let ctaClicks = 0;
  let formStarts = 0;
  let formSubmits = 0;

  for (const row of rows) {
    const page = byPage.get(row.pagePath) || { views: 0, ctaClicks: 0, formSubmits: 0 };

    if (row.eventName === "page_view") {
      views += row.count;
      page.views += row.count;
      bySource.set(row.source, (bySource.get(row.source) || 0) + row.count);
    } else if (row.eventName === "cta_click") {
      ctaClicks += row.count;
      page.ctaClicks += row.count;
      if (row.eventLabel) byCta.set(row.eventLabel, (byCta.get(row.eventLabel) || 0) + row.count);
    } else if (row.eventName === "form_start") {
      formStarts += row.count;
    } else if (row.eventName === "form_submit") {
      formSubmits += row.count;
      page.formSubmits += row.count;
    }

    byPage.set(row.pagePath, page);
  }

  const topPages = [...byPage.entries()]
    .map(([pagePath, value]) => ({
      pagePath,
      ...value,
      actionRate: ratio(value.ctaClicks + value.formSubmits, value.views)
    }))
    .filter((item) => item.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, 8);

  const sources = [...bySource.entries()]
    .map(([source, sourceViews]) => ({ source, views: sourceViews }))
    .sort((a, b) => b.views - a.views);

  const ctas = [...byCta.entries()]
    .map(([label, clicks]) => ({ label, clicks }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 8);

  const opportunities: AnalyticsOpportunity[] = [];

  const weakCtaPage = topPages.find((page) => page.views >= 10 && page.ctaClicks === 0 && page.formSubmits === 0);
  if (weakCtaPage) {
    const score = Math.min(100, Math.round(40 + Math.min(60, weakCtaPage.views * 2)));
    opportunities.push({
      key: "cta",
      priority: score >= 70 ? "high" : "medium",
      impact: weakCtaPage.views >= 25 ? "high" : "medium",
      confidence: weakCtaPage.views >= 30 ? "high" : "medium",
      score,
      evidenceCount: weakCtaPage.views,
      pagePath: weakCtaPage.pagePath,
      value: weakCtaPage.views
    });
  }

  if (formStarts >= 5 && formSubmits / formStarts < 0.5) {
    const completionRate = ratio(formSubmits, formStarts);
    const abandonmentSeverity = 100 - completionRate;
    const sampleStrength = Math.min(100, Math.round((formStarts / 20) * 100));
    const score = Math.min(100, Math.round(abandonmentSeverity * 0.55 + sampleStrength * 0.45));
    opportunities.push({
      key: "form",
      priority: score >= 70 ? "high" : "medium",
      impact: completionRate <= 30 || formStarts >= 12 ? "high" : "medium",
      confidence: formStarts >= 15 ? "high" : "medium",
      score,
      evidenceCount: formStarts,
      value: completionRate
    });
  }

  const dominantSource = sources[0];
  if (views >= 20 && dominantSource && dominantSource.views / views >= 0.8) {
    const concentration = ratio(dominantSource.views, views);
    const sampleStrength = Math.min(100, views);
    const score = Math.min(100, Math.round(concentration * 0.65 + sampleStrength * 0.35));
    opportunities.push({
      key: "acquisition",
      priority: score >= 70 ? "high" : "medium",
      impact: concentration >= 90 ? "high" : "medium",
      confidence: views >= 50 ? "high" : "medium",
      score,
      evidenceCount: views,
      value: concentration
    });
  }

  opportunities.sort((a, b) => b.score - a.score);

  return {
    views,
    ctaClicks,
    formStarts,
    formSubmits,
    actionRate: ratio(ctaClicks + formSubmits, views),
    contactCompletionRate: formStarts > 0 ? ratio(formSubmits, formStarts) : null,
    topPages,
    sources,
    ctas,
    opportunities
  };
}

export function compareSiteAnalytics(
  rows: SiteAnalyticsRow[],
  periodDays: AnalyticsPeriodDays,
  now = new Date()
): AnalyticsComparison {
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);

  const currentStart = new Date(today);
  currentStart.setUTCDate(currentStart.getUTCDate() - (periodDays - 1));

  const previousEnd = new Date(currentStart);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);

  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - (periodDays - 1));

  const currentStartKey = dayKey(currentStart);
  const todayKey = dayKey(today);
  const previousStartKey = dayKey(previousStart);
  const previousEndKey = dayKey(previousEnd);

  const currentRows = rows.filter((row) => row.day >= currentStartKey && row.day <= todayKey);
  const previousRows = rows.filter((row) => row.day >= previousStartKey && row.day <= previousEndKey);
  const current = summarizeSiteAnalytics(currentRows);
  const previous = summarizeSiteAnalytics(previousRows);

  return {
    current,
    previous,
    periodDays,
    deltas: {
      views: deltaPercent(current.views, previous.views),
      ctaClicks: deltaPercent(current.ctaClicks, previous.ctaClicks),
      formSubmits: deltaPercent(current.formSubmits, previous.formSubmits),
      actionRatePoints: Math.round((current.actionRate - previous.actionRate) * 10) / 10
    }
  };
}


export function evaluatePostPublishPerformance(
  rows: SiteAnalyticsRow[],
  publishedAt: string | null,
  now = new Date()
): PostPublishPerformance {
  if (!publishedAt) {
    return { status: "no_marker", windowDays: 0, before: null, after: null, actionRatePoints: 0, outcome: null };
  }

  const published = new Date(publishedAt);
  if (!Number.isFinite(published.getTime())) {
    return { status: "no_marker", windowDays: 0, before: null, after: null, actionRatePoints: 0, outcome: null };
  }

  published.setUTCHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const fullDaysAfter = Math.floor((today.getTime() - published.getTime()) / 86400000);

  if (fullDaysAfter < 3) {
    return { status: "collecting", windowDays: Math.max(0, fullDaysAfter), before: null, after: null, actionRatePoints: 0, outcome: null };
  }

  const windowDays = Math.min(14, fullDaysAfter);
  const afterStart = new Date(published);
  afterStart.setUTCDate(afterStart.getUTCDate() + 1);
  const afterEnd = new Date(afterStart);
  afterEnd.setUTCDate(afterEnd.getUTCDate() + (windowDays - 1));

  const beforeEnd = new Date(published);
  beforeEnd.setUTCDate(beforeEnd.getUTCDate() - 1);
  const beforeStart = new Date(beforeEnd);
  beforeStart.setUTCDate(beforeStart.getUTCDate() - (windowDays - 1));

  const afterRows = rows.filter((row) => row.day >= dayKey(afterStart) && row.day <= dayKey(afterEnd));
  const beforeRows = rows.filter((row) => row.day >= dayKey(beforeStart) && row.day <= dayKey(beforeEnd));
  const before = summarizeSiteAnalytics(beforeRows);
  const after = summarizeSiteAnalytics(afterRows);
  const actionRatePoints = Math.round((after.actionRate - before.actionRate) * 10) / 10;

  if (before.views + after.views < 20 || before.views < 5 || after.views < 5) {
    return { status: "low_signal", windowDays, before, after, actionRatePoints, outcome: null };
  }

  const outcome = actionRatePoints >= 1
    ? "improved"
    : actionRatePoints <= -1
      ? "declined"
      : "stable";

  return { status: "measured", windowDays, before, after, actionRatePoints, outcome };
}
