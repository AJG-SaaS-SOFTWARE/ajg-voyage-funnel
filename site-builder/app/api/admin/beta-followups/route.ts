import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_ACTIONS = new Set(["essential", "publish", "compare", "growth_explore", "feedback"]);

function bearer(request: Request) {
  const value = request.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

type AdminContext =
  | { ok: false; response: NextResponse }
  | { ok: true; service: SupabaseClient; adminUserId: string };

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
    adminUserId: user.id,
    service: createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  };
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
  const siteId = typeof body?.siteId === "string" && body.siteId.trim() ? body.siteId.trim() : null;
  const nextAction = typeof body?.nextAction === "string" ? body.nextAction.trim() : "";
  const channel = body?.channel === "other" ? "other" : "email";

  if (!userId || !VALID_ACTIONS.has(nextAction)) {
    return NextResponse.json({ error: "Relance invalide." }, { status: 400 });
  }

  const { data: targetUser, error: targetError } = await auth.service.auth.admin.getUserById(userId);
  if (targetError || !targetUser.user) {
    return NextResponse.json({ error: "Beta Tester introuvable." }, { status: 404 });
  }

  const { data: grant, error: grantError } = await auth.service
    .from("beta_access_grants")
    .select("active")
    .eq("user_id", userId)
    .maybeSingle();
  if (grantError) {
    return NextResponse.json({ error: "Accès bêta indisponible." }, { status: 503 });
  }
  if (targetUser.user.app_metadata?.ajg_beta !== true && grant?.active !== true) {
    return NextResponse.json({ error: "Ce compte ne fait pas partie de la cohorte bêta." }, { status: 409 });
  }

  const { data: previous, error: previousError } = await auth.service
    .from("beta_followups")
    .select("id,sent_at,mission_next_action")
    .eq("user_id", userId)
    .eq("mission_next_action", nextAction)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (previousError) {
    return NextResponse.json({ error: "Historique de relance indisponible." }, { status: 503 });
  }

  if (previous?.sent_at) {
    const ageHours = (Date.now() - Date.parse(previous.sent_at)) / 3_600_000;
    if (Number.isFinite(ageHours) && ageHours < 24) {
      return NextResponse.json(
        {
          error: "Une relance sur cette même étape a déjà été enregistrée dans les dernières 24 h.",
          lastSentAt: previous.sent_at
        },
        { status: 409 }
      );
    }
  }

  const sentAt = new Date().toISOString();
  const { data, error: insertError } = await auth.service
    .from("beta_followups")
    .insert({
      user_id: userId,
      site_id: siteId,
      mission_next_action: nextAction,
      channel,
      admin_user_id: auth.adminUserId,
      sent_at: sentAt
    })
    .select("id,user_id,site_id,mission_next_action,channel,sent_at")
    .single();

  if (insertError) {
    return NextResponse.json({ error: "Enregistrement de la relance impossible." }, { status: 503 });
  }

  return NextResponse.json({ followUp: data }, { headers: { "Cache-Control": "private, no-store" } });
}
