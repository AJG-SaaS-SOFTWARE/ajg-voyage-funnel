import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

  const { data, error } = await auth.service
    .from("support_tickets")
    .select("id,user_id,site_id,category,severity,subject,message,status,diagnosis,client_action,resolution_code,created_at,updated_at,resolved_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: "Tickets indisponibles." }, { status: 503 });
  return NextResponse.json({ tickets: data || [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if ("response" in auth) return auth.response;
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const status = typeof body?.status === "string" ? body.status : "";
  const resolutionCode = typeof body?.resolutionCode === "string" ? body.resolutionCode.trim().slice(0,120) : null;
  if (!id || !statuses.has(status)) return NextResponse.json({ error: "Mise à jour invalide." }, { status: 400 });

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
  return NextResponse.json({ ticket: data }, { headers: { "Cache-Control": "private, no-store" } });
}
