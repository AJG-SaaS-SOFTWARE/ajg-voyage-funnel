import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSupportOperationsAgent } from "../../../../lib/support-operations-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

function bearer(request: Request) {
  const value = request.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

async function requireAdmin(request: Request): Promise<{ service: SupabaseClient } | { response: NextResponse }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publishable || !serviceKey) return { response: NextResponse.json({ error: "Admin indisponible." }, { status: 503 }) };
  const token = bearer(request);
  if (!token) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const userClient = createClient(url, publishable, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await userClient.auth.getUser(token);
  if (error || !user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: role, error: roleError } = await userClient.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (roleError || role?.role !== "admin") return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { service: createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) };
}

async function status(service: SupabaseClient) {
  const { data, error } = await service
    .from("support_operations_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(14);
  if (error) throw error;
  const runs = data || [];
  const latest = runs[0] || null;
  return {
    latest,
    attentionRequired: Boolean(latest && (
      latest.status === "failed" ||
      latest.runtime_status === "incident" ||
      latest.reconcile_failed > 0 ||
      latest.remediation_failed > 0
    )),
    runs
  };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("response" in auth) return auth.response;
  try {
    return NextResponse.json(await status(auth.service), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "État de l’agent RUN indisponible." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("response" in auth) return auth.response;
  try {
    const result = await runSupportOperationsAgent(auth.service);
    return NextResponse.json({ result, ...(await status(auth.service)) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: "Exécution de l’agent RUN impossible.", detail: error instanceof Error ? error.message : "unknown" }, { status: 503 });
  }
}
