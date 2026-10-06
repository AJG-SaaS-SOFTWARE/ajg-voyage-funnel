import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENTS = new Set(["page_view", "cta_click", "form_start", "form_submit"]);
const LABEL = /^[a-z0-9_-]{0,40}$/;
const PAGE_PATH = /^\/[A-Za-z0-9/_%.-]*$/;

function classifyReferrer(referrer: string, currentHost: string) {
  if (!referrer) return "direct";
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
    const ownHost = currentHost.toLowerCase().split(":")[0].replace(/^www\./, "");
    if (!host) return "direct";
    if (host === ownHost) return "internal";

    const searchHosts = ["google.", "bing.com", "duckduckgo.com", "search.yahoo.", "ecosia.org", "qwant.com"];
    if (searchHosts.some((item) => host.includes(item))) return "search";

    const socialHosts = [
      "facebook.com", "instagram.com", "linkedin.com", "t.co", "x.com",
      "tiktok.com", "youtube.com", "youtu.be", "pinterest.", "reddit.com",
      "threads.net", "bsky.app"
    ];
    if (socialHosts.some((item) => host.includes(item))) return "social";
    return "referral";
  } catch {
    return "other";
  }
}

function dailyFingerprint(request: Request, siteId: string, secret: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const realIp = request.headers.get("x-real-ip")?.trim() || "";
  const agent = request.headers.get("user-agent")?.slice(0, 300) || "";
  const day = new Date().toISOString().slice(0, 10);
  return createHmac("sha256", secret)
    .update(`${day}|${siteId}|${forwarded || realIp || "unknown"}|${agent}`)
    .digest("hex");
}

export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > 4096) {
    return NextResponse.json({ error: "invalid_analytics_event" }, { status: 413 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_analytics_event" }, { status: 400 });
  }

  const siteId = typeof body.siteId === "string" ? body.siteId.trim() : "";
  const eventName = typeof body.eventName === "string" ? body.eventName.trim().toLowerCase() : "";
  const pagePath = typeof body.pagePath === "string" ? body.pagePath.trim() : "/";
  const eventLabel = typeof body.eventLabel === "string" ? body.eventLabel.trim().toLowerCase() : "";
  const referrer = typeof body.referrer === "string" ? body.referrer.slice(0, 500) : "";

  if (
    !UUID.test(siteId)
    || !EVENTS.has(eventName)
    || pagePath.length > 160
    || !PAGE_PATH.test(pagePath)
    || !LABEL.test(eventLabel)
  ) {
    return NextResponse.json({ error: "invalid_analytics_event" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return new NextResponse(null, { status: 204 });
  }

  const host = request.headers.get("host") || "";
  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { error } = await service.rpc("record_site_analytics_event", {
    p_site_id: siteId,
    p_event_name: eventName,
    p_page_path: pagePath || "/",
    p_source: classifyReferrer(referrer, host),
    p_event_label: eventLabel,
    p_fingerprint: dailyFingerprint(request, siteId, serviceKey)
  });

  if (error) {
    console.error("Public analytics event unavailable", {
      siteId,
      eventName,
      error: error.message
    });
  }

  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" }
  });
}
