import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { recordSupportEvent } from "../../../../lib/support-events";
import { calculateSupportMetrics } from "../../../../lib/support-metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const statuses = new Set(["new","diagnosed","waiting_customer","in_progress","resolved","closed"]);

function bearer(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
}

async function requireAdmin(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = bearer(request);
  if (!url || !publishable || !serviceKey) return { response: NextResponse.json({ error: "Admin indisponible." }, { status: 503 }) };
  if (!token) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const userClient = createClient(url, publishable, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: { user }, error } = await userClient.auth.getUser(token);
  if (error || !user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: role, error: roleError } = await userClient.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (roleError || role?.role !== "admin") return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };

  return { service: createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("response" in auth) return auth.response;

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [
    queue,
    metricTickets,
    events,
    remediations,
    activeSites
  ] = await Promise.all([
    auth.service
      .from("support_tickets")
      .select("id,user_id,site_id,category,severity,subject,message,status,diagnosis,client_action,resolution_code,created_at,updated_at,resolved_at")
      .order("created_at", { ascending: false })
      .limit(100),
    auth.service
      .from("support_tickets")
      .select("id,category,status,resolution_code,created_at")
      .gte("created_at", since)
      .limit(1000),
    auth.service
      .from("support_ticket_events")
      .select("ticket_id,actor_type,event_type,metadata,created_at")
      .gte("created_at", since)
      .limit(5000),
    auth.service
      .from("support_remediation_runs")
      .select("status,result_code,trigger_source,created_at")
      .gte("created_at", since)
      .limit(5000),
    auth.service
      .from("sites")
      .select("owner_id")
      .eq("status", "published")
      .eq("privacy_state", "active")
      .limit(5000)
  ]);

  if (queue.error) {
    return NextResponse.json(
      { error: "Tickets indisponibles." },
      { status: 503 }
    );
  }

  const metricError =
    metricTickets.error ||
    events.error ||
    remediations.error ||
    activeSites.error;

  const metrics = metricError
    ? null
    : calculateSupportMetrics({
        tickets: (metricTickets.data || []) as any[],
        events: (events.data || []) as any[],
        remediations: (remediations.data || []) as any[],
        sites: (activeSites.data || []) as any[]
      });

  if (metricError) {
    console.error("Support KPI aggregation unavailable", {
      tickets: metricTickets.error?.code || null,
      events: events.error?.code || null,
      remediations: remediations.error?.code || null,
      sites: activeSites.error?.code || null
    });
  }

  return NextResponse.json(
    { tickets: queue.data || [], metrics },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if ("response" in auth) return auth.response;
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const status = typeof body?.status === "string" ? body.status : "";
  const resolutionCode = typeof body?.resolutionCode === "string" ? body.resolutionCode.trim().slice(0,120) : null;
  if (!id || !statuses.has(status)) return NextResponse.json({ error: "Mise à jour invalide." }, { status: 400 });

  const { data: current, error: currentError } = await auth.service
    .from("support_tickets")
    .select("id,status")
    .eq("id", id)
    .maybeSingle();
  if (currentError || !current) {
    return NextResponse.json({ error: "Ticket introuvable." }, { status: 404 });
  }

  const resolved = status === "resolved" || status === "closed";
  const { data, error } = await auth.service
    .from("support_tickets")
    .update({
      status,
      resolution_code: resolutionCode || null,
      resolved_at: resolved ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .select("id,status,resolution_code,resolved_at,updated_at")
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: "Ticket introuvable." }, { status: 404 });

  await recordSupportEvent(auth.service, {
    ticketId: data.id,
    actor: "admin",
    type: resolved ? "resolution" : "status",
    metadata: {
      previous_status: current.status,
      status: data.status,
      resolution_code: data.resolution_code
    }
  });

  return NextResponse.json({ ticket: data }, { headers: { "Cache-Control": "private, no-store" } });
}
