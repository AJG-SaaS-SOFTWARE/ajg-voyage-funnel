import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  runSupportRepair,
  type SupportRepairAction
} from "../../../../lib/support-remediation";
import { diagnoseSupportHealth } from "../../../../lib/support-health-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const actions = new Set<SupportRepairAction>(["managed_domain_repair"]);

function bearer(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
}

async function context(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = bearer(request);

  if (!url || !publishable || !serviceKey) {
    return {
      response: NextResponse.json(
        { error: "Correction automatique indisponible." },
        { status: 503 }
      )
    };
  }
  if (!token) {
    return {
      response: NextResponse.json(
        { error: "Connexion requise." },
        { status: 401 }
      )
    };
  }

  const userClient = createClient(url, publishable, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const {
    data: { user },
    error
  } = await userClient.auth.getUser(token);

  if (error || !user) {
    return {
      response: NextResponse.json(
        { error: "Connexion requise." },
        { status: 401 }
      )
    };
  }

  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return { user, service };
}

export async function POST(request: Request) {
  const auth = await context(request);
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const siteId = typeof body?.siteId === "string" ? body.siteId : "";
  const action = typeof body?.action === "string" ? body.action : "";
  const ticketId = typeof body?.ticketId === "string" ? body.ticketId : null;

  if (!siteId || !actions.has(action as SupportRepairAction)) {
    return NextResponse.json(
      { error: "Correction automatique invalide." },
      { status: 400 }
    );
  }

  const since = new Date(Date.now() - 60_000).toISOString();
  const { count, error: limitError } = await auth.service
    .from("support_remediation_runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.user.id)
    .eq("site_id", siteId)
    .eq("action", action)
    .gte("created_at", since);

  if (limitError) {
    return NextResponse.json(
      { error: "Contrôle de correction indisponible." },
      { status: 503 }
    );
  }
  if ((count || 0) >= 2) {
    return NextResponse.json(
      { error: "Cette correction vient déjà d’être tentée. Relancez le diagnostic dans quelques instants." },
      { status: 429 }
    );
  }

  const result = await runSupportRepair(auth.service, {
    userId: auth.user.id,
    siteId,
    action: action as SupportRepairAction,
    trigger: "client",
    ticketId
  });

  const health = await diagnoseSupportHealth(
    auth.service,
    auth.user.id,
    siteId
  );

  return NextResponse.json(
    { result, health },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
