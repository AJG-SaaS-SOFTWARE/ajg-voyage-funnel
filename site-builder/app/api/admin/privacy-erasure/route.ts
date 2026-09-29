import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { purgeBuilderAccount, purgeBuilderSite } from "../../../../lib/privacy-purge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

type AdminContext =
  | { ok: false; response: NextResponse }
  | { ok: true; service: SupabaseClient };

function bearer(request: Request) {
  const value = request.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

async function requireAdmin(request: Request): Promise<AdminContext> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";

  if (!url || !publishable || !serviceKey) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Administration indisponible." }, { status: 503 })
    };
  }

  const token = bearer(request);
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    };
  }

  const userClient = createClient(url, publishable, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const {
    data: { user },
    error: userError
  } = await userClient.auth.getUser(token);
  if (userError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    };
  }

  const { data: role, error: roleError } = await userClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleError || role?.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 })
    };
  }

  return {
    ok: true,
    service: createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  };
}

async function presentRequest(service: SupabaseClient, row: any) {
  let email = "";
  let siteSlug = "";

  if (row.user_id) {
    const { data } = await service.auth.admin.getUserById(row.user_id);
    email = data.user?.email || "";
  }
  if (row.site_id) {
    const { data } = await service
      .from("sites")
      .select("slug")
      .eq("id", row.site_id)
      .maybeSingle();
    siteSlug = data?.slug || "";
  }

  return {
    id: row.id,
    scope: row.scope,
    status: row.status,
    requestedAt: row.requested_at,
    processingStartedAt: row.processing_started_at,
    completedAt: row.completed_at,
    userId: row.user_id,
    siteId: row.site_id,
    email,
    siteSlug,
    systemsProcessed: Array.isArray(row.systems_processed)
      ? row.systems_processed
      : [],
    hasProcessingError: Boolean(row.last_error)
  };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.service
    .from("data_erasure_requests")
    .select(
      "id,user_id,site_id,scope,status,requested_at,processing_started_at,completed_at,systems_processed,last_error"
    )
    .order("requested_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: "Demandes RGPD indisponibles." }, { status: 503 });
  }

  const requests = await Promise.all((data || []).map((row) => presentRequest(auth.service, row)));
  return NextResponse.json(
    { requests },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 4096) {
    return NextResponse.json({ error: "Requête trop volumineuse." }, { status: 413 });
  }

  const body = await request.json().catch(() => ({}));
  const requestId = typeof body?.requestId === "string" ? body.requestId : "";
  const confirmation =
    typeof body?.confirmation === "string" ? body.confirmation.trim() : "";

  if (!requestId || confirmation !== "PURGER") {
    return NextResponse.json(
      { error: "Recopiez exactement PURGER pour confirmer cette action irréversible." },
      { status: 400 }
    );
  }

  const { data: erasure, error: readError } = await auth.service
    .from("data_erasure_requests")
    .select(
      "id,user_id,site_id,scope,status,systems_processed,processing_started_at"
    )
    .eq("id", requestId)
    .maybeSingle();

  if (readError || !erasure) {
    return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
  }
  if (erasure.status === "completed") {
    return NextResponse.json({
      ok: true,
      alreadyCompleted: true,
      systemsProcessed: erasure.systems_processed || []
    });
  }
  if (erasure.status === "canceled") {
    return NextResponse.json({ error: "Cette demande a été annulée." }, { status: 409 });
  }
  if (!["requested", "processing"].includes(erasure.status)) {
    return NextResponse.json({ error: "État de demande non traitable." }, { status: 409 });
  }

  const { error: processingError } = await auth.service
    .from("data_erasure_requests")
    .update({
      status: "processing",
      processing_started_at: erasure.processing_started_at || new Date().toISOString(),
      last_error: null
    })
    .eq("id", requestId);
  if (processingError) {
    return NextResponse.json({ error: "Impossible de verrouiller la demande." }, { status: 503 });
  }

  try {
    let result: { systems: string[]; sitesPurged: number };

    if (erasure.scope === "site") {
      if (!erasure.site_id) {
        result = { systems: ["site_already_absent"], sitesPurged: 0 };
      } else if (!erasure.user_id) {
        throw new Error("erasure_owner_missing");
      } else {
        result = await purgeBuilderSite(auth.service, erasure.site_id, erasure.user_id);
      }
    } else if (erasure.scope === "account") {
      if (!erasure.user_id) {
        result = { systems: ["account_already_absent"], sitesPurged: 0 };
      } else {
        result = await purgeBuilderAccount(auth.service, erasure.user_id);
      }
    } else {
      throw new Error("invalid_erasure_scope");
    }

    const systems = Array.from(
      new Set([
        ...(Array.isArray(erasure.systems_processed) ? erasure.systems_processed : []),
        ...result.systems
      ])
    );

    const { error: finishError } = await auth.service
      .from("data_erasure_requests")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        systems_processed: systems,
        last_error: null
      })
      .eq("id", requestId);
    if (finishError) throw finishError;

    return NextResponse.json({
      ok: true,
      sitesPurged: result.sitesPurged,
      systemsProcessed: systems
    });
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "unknown";
    console.error("GDPR controlled purge failed", {
      requestId,
      scope: erasure.scope,
      code: errorCode
    });

    await auth.service
      .from("data_erasure_requests")
      .update({
        status: "processing",
        last_error: errorCode.slice(0, 500)
      })
      .eq("id", requestId);

    return NextResponse.json(
      {
        error:
          "La purge n’a pas été finalisée. La demande reste verrouillée et peut être reprise sans réactiver le site."
      },
      { status: 500 }
    );
  }
}
