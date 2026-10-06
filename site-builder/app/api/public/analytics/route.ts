import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const siteIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const botPattern = /bot|crawler|spider|preview|facebookexternalhit|slurp|bingpreview|headless|lighthouse|pagespeed/i;
const allowedMetrics = new Set(["page_view", "primary_cta_click", "contact_submit"]);

function response(status = 204) {
  return new NextResponse(null, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) return response(204);

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return response(204);

  const userAgent = request.headers.get("user-agent") || "";
  if (botPattern.test(userAgent)) return response(204);

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 4096) return response(204);

  const body = await request.json().catch(() => null);
  const siteId = typeof body?.siteId === "string" ? body.siteId.trim() : "";
  const pageKey = typeof body?.pageKey === "string" ? body.pageKey.trim() : "";
  const metricKey = typeof body?.metricKey === "string" ? body.metricKey.trim() : "";

  if (
    !siteIdPattern.test(siteId) ||
    !pageKey ||
    pageKey.length > 120 ||
    !allowedMetrics.has(metricKey)
  ) {
    return response(204);
  }

  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { error } = await service.rpc("increment_site_daily_metric", {
    p_site_id: siteId,
    p_page_key: pageKey,
    p_metric_key: metricKey
  });

  if (error) {
    console.error("public_analytics_increment_failed", {
      code: error.code || "unknown"
    });
  }

  return response(204);
}
