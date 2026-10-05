import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { finopsAlerts, finopsMonth, type AiFinopsReport } from "../../../../lib/ai-finops-report";
import { aiUsageAnomalyMessage, detectAiUsageAnomaly } from "../../../../lib/ai-usage-anomaly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return response({ error: "Unauthorized" }, 401);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publishable || !serviceKey) return response({ error: "Rapport FinOps indisponible." }, 503);

  try {
    const client = createClient(url, publishable, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: { user }, error: userError } = await client.auth.getUser(token);
    if (userError || !user) return response({ error: "Unauthorized" }, 401);
    const { data: role, error: roleError } = await client.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    if (roleError || role?.role !== "admin") return response({ error: "Forbidden" }, 403);

    let month: string;
    try { month = finopsMonth(new URL(request.url).searchParams.get("month")); }
    catch { return response({ error: "Choisissez un mois valide, antérieur ou égal au mois courant." }, 400); }

    // No service-role query is made until the user's server-side role is verified.
    const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const anomalySince = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data, error }, status, anomalyRows] = await Promise.all([
      service.rpc("ai_finops_monthly_report", { p_month: month + "-01" }),
      service.rpc("get_ai_finops_monitor_status"),
      service
        .from("ai_cost_reservations")
        .select("created_at,charged_micros")
        .gte("created_at", anomalySince)
        .order("created_at", { ascending: false })
        .limit(5000)
    ]);
    if (error || !data?.policy || data.currency !== "USD" || data.month !== month) {
      return response({ error: "Rapport FinOps indisponible. Réessayez après vérification de la base." }, 503);
    }
    const report = data as AiFinopsReport;
    const monitor = !status.error && Array.isArray(status.data?.items) ? status.data : null;
    const anomaly = anomalyRows.error
      ? detectAiUsageAnomaly([], Date.now(), true)
      : detectAiUsageAnomaly(anomalyRows.data || [], Date.now(), (anomalyRows.data || []).length >= 5000);
    const anomalyMessage = aiUsageAnomalyMessage(anomaly);
    const alerts = finopsAlerts(report);
    if (anomalyMessage) {
      alerts.unshift({
        key: "usage-anomaly",
        level: anomaly.status === "critical" ? "critical" : anomaly.status === "warning" ? "warning" : "info",
        message: anomalyMessage
      });
    }
    return response({ report, alerts, monitor, anomaly, generatedAt: new Date().toISOString() });
  } catch {
    return response({ error: "Rapport FinOps indisponible. Réessayez dans quelques instants." }, 503);
  }
}
