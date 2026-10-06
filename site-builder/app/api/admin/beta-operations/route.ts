import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runBetaOperationsAgent } from "../../../../lib/beta-operations-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function bearer(request: Request) {
  const value = request.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

type AdminContext =
  | { ok: false; response: NextResponse }
  | { ok: true; service: SupabaseClient };

async function requireAdmin(request: Request): Promise<AdminContext> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !publishable || !serviceKey) {
    return { ok: false, response: NextResponse.json({ error: "Admin unavailable" }, { status: 503 }) };
  }

  const token = bearer(request);
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const userClient = createClient(url, publishable, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: { user }, error } = await userClient.auth.getUser(token);
  if (error || !user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: role, error: roleError } = await userClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (roleError || role?.role !== "admin") {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return {
    ok: true,
    service: createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  };
}

async function status(service: SupabaseClient) {
  const { data, error } = await service
    .from("beta_operations_runs")
    .select("id,started_at,completed_at,status,scanned_users,grant_count,active_tester_count,repaired_metadata,revoked_stale_metadata,repair_failures,follow_up_candidates,awaiting_resume,unresponsive_after_followup,completed_missions,errors")
    .order("started_at", { ascending: false })
    .limit(14);
  if (error) throw error;

  const runs = data || [];
  const latest = runs[0] || null;
  const lastSuccess = runs.find((run) => run.status === "healthy" || run.status === "attention") || null;
  const attentionRequired = Boolean(
    latest &&
    (
      latest.status === "failed" ||
      latest.repair_failures > 0 ||
      latest.unresponsive_after_followup > 0
    )
  );

  return {
    latest,
    lastSuccessAt: lastSuccess?.completed_at || null,
    attentionRequired,
    runs
  };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    return NextResponse.json(await status(auth.service), {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch {
    return NextResponse.json({ error: "Journal de l’agent bêta indisponible." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await runBetaOperationsAgent(auth.service);
    return NextResponse.json(
      { result, ...(await status(auth.service)) },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Exécution de l’agent bêta impossible.",
        detail: error instanceof Error ? error.message : "unknown"
      },
      { status: 503 }
    );
  }
}
