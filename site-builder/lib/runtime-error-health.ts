import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type ErrorRequest = {
  path?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type ErrorContext = {
  routePath?: string;
  routeType?: string;
};

function headerValue(headers: ErrorRequest["headers"], key: string) {
  const value = headers?.[key] ?? headers?.[key.toLowerCase()] ?? headers?.[key.toUpperCase()];
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function normalizedHost(request: ErrorRequest) {
  const raw = headerValue(request.headers, "host").trim().toLowerCase();
  if (!raw) return "";
  const bracket = raw.startsWith("[") ? raw.indexOf("]") : -1;
  if (bracket >= 0) return raw.slice(1, bracket);
  return raw.split(":")[0];
}

function routePattern(value: unknown) {
  const route = typeof value === "string" && value.trim() ? value.trim() : "unknown";
  return route.replace(/[\r\n\t]/g, " ").slice(0, 200);
}

function routeKind(value: unknown) {
  return ["render", "route", "action", "proxy"].includes(String(value))
    ? String(value)
    : "unknown";
}

export function runtimeErrorCode(error: unknown, routePath: string) {
  const digest =
    error && typeof error === "object" && "digest" in error
      ? String((error as { digest?: unknown }).digest || "").trim()
      : "";
  if (digest) {
    return `next:${digest.replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, 90)}`;
  }

  const name =
    error && typeof error === "object" && "name" in error
      ? String((error as { name?: unknown }).name || "Error")
      : "Error";
  return `hash:${createHash("sha256").update(`${name}|${routePath}`).digest("hex").slice(0, 32)}`;
}

async function siteIdFromRequest(service: SupabaseClient, request: ErrorRequest) {
  const host = normalizedHost(request);
  if (host) {
    const { data: domain, error } = await service
      .from("domains")
      .select("site_id")
      .eq("hostname", host)
      .maybeSingle();
    if (!error && domain?.site_id) return String(domain.site_id);
  }

  const path = typeof request.path === "string" ? request.path.split("?")[0] : "";
  const match = path.match(/^\/site\/([^/]+)/);
  if (!match) return null;

  let slug = "";
  try {
    slug = decodeURIComponent(match[1]).trim();
  } catch {
    return null;
  }
  if (!slug) return null;

  const { data: site, error } = await service
    .from("sites")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  return !error && site?.id ? String(site.id) : null;
}

export async function recordNextRuntimeError(
  error: unknown,
  request: ErrorRequest,
  context: ErrorContext
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;

  try {
    const service = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const routePath = routePattern(context.routePath);
    const siteId = await siteIdFromRequest(service, request);
    await service.from("runtime_error_events").insert({
      site_id: siteId,
      route_path: routePath,
      route_type: routeKind(context.routeType),
      error_code: runtimeErrorCode(error, routePath)
    });
  } catch {
    // Error reporting must never create a second application failure.
  }
}

export async function recentRuntimeErrorHealth(
  service: SupabaseClient,
  siteId: string,
  now = new Date()
) {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const hourSince = new Date(now.getTime() - 60 * 60 * 1000).getTime();

  try {
    const { data, error } = await service
      .from("runtime_error_events")
      .select("error_code,created_at")
      .eq("site_id", siteId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) return null;
    const rows = data || [];
    const lastHour = rows.filter((row: any) => Date.parse(row.created_at) >= hourSince).length;
    return {
      lastHour,
      lastDay: rows.length,
      distinctCodes: new Set(rows.map((row: any) => String(row.error_code))).size,
      truncated: rows.length >= 500
    };
  } catch {
    return null;
  }
}
