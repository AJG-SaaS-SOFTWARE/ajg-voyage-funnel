import { getSupabaseBrowserClient } from "./supabase-browser";
import { getCurrentUser } from "./supabase-site-repository";

export type SiteAnalyticsEventName = "page_view" | "cta_click" | "form_start" | "form_submit";
export type SiteAnalyticsSource = "direct" | "internal" | "search" | "social" | "referral" | "other";

export type SiteAnalyticsRow = {
  day: string;
  eventName: SiteAnalyticsEventName;
  pagePath: string;
  source: SiteAnalyticsSource;
  eventLabel: string;
  count: number;
};

export type SiteAnalyticsSummary = {
  views: number;
  ctaClicks: number;
  formStarts: number;
  formSubmits: number;
  actionRate: number;
  contactCompletionRate: number | null;
  topPages: Array<{ pagePath: string; views: number; ctaClicks: number; formSubmits: number }>;
  sources: Array<{ source: SiteAnalyticsSource; views: number }>;
  ctas: Array<{ label: string; clicks: number }>;
  opportunities: AnalyticsOpportunity[];
};

export type AnalyticsOpportunity = {
  key: "cta" | "form" | "acquisition";
  priority: "high" | "medium";
  pagePath?: string;
  value: number;
};

export async function getMySiteAnalytics(siteId: string, days = 30): Promise<SiteAnalyticsRow[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const user = await getCurrentUser();
  if (!user) return [];

  const safeDays = Math.min(90, Math.max(7, Math.round(days)));
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (safeDays - 1));
  const sinceDay = since.toISOString().slice(0, 10);

  // The table is introduced by an additive migration. Keep this client read isolated
  // until the generated database types are refreshed from the production schema.
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
    .map(([pagePath, value]) => ({ pagePath, ...value }))
    .filter((item) => item.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, 6);

  const sources = [...bySource.entries()]
    .map(([source, sourceViews]) => ({ source, views: sourceViews }))
    .sort((a, b) => b.views - a.views);

  const ctas = [...byCta.entries()]
    .map(([label, clicks]) => ({ label, clicks }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 6);

  const opportunities: AnalyticsOpportunity[] = [];

  const weakCtaPage = topPages.find((page) => page.views >= 10 && page.ctaClicks === 0 && page.formSubmits === 0);
  if (weakCtaPage) {
    opportunities.push({
      key: "cta",
      priority: weakCtaPage.views >= 25 ? "high" : "medium",
      pagePath: weakCtaPage.pagePath,
      value: weakCtaPage.views
    });
  }

  if (formStarts >= 5 && formSubmits / formStarts < 0.5) {
    opportunities.push({
      key: "form",
      priority: formStarts >= 12 ? "high" : "medium",
      value: ratio(formSubmits, formStarts)
    });
  }

  const dominantSource = sources[0];
  if (views >= 20 && dominantSource && dominantSource.views / views >= 0.8) {
    opportunities.push({
      key: "acquisition",
      priority: views >= 50 ? "high" : "medium",
      value: ratio(dominantSource.views, views)
    });
  }

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
