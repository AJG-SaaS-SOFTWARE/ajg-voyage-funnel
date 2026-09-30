import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { diagnoseSupportHealth } from "../../../../lib/support-health-server";
import { supportReconcileDecision } from "../../../../lib/support-reconcile-policy";
import { recordSupportEvent } from "../../../../lib/support-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const categories = new Set(["bug","domain","publication","billing","ai","data","other"]);

function bearer(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
}

async function context(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = bearer(request);
  if (!url || !publishable || !serviceKey) return { response: NextResponse.json({ error: "Support indisponible." }, { status: 503 }) };
  if (!token) return { response: NextResponse.json({ error: "Connexion requise." }, { status: 401 }) };

  const userClient = createClient(url, publishable, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: { user }, error } = await userClient.auth.getUser(token);
  if (error || !user) return { response: NextResponse.json({ error: "Connexion requise." }, { status: 401 }) };

  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return { user, service };
}

export async function GET(request: Request) {
  const auth = await context(request);
  if ("response" in auth) return auth.response;

  const [{ data: tickets, error: ticketError }, health] = await Promise.all([
    auth.service
      .from("support_tickets")
      .select("id,site_id,category,severity,subject,message,status,diagnosis,client_action,resolution_code,created_at,updated_at,resolved_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    diagnoseSupportHealth(auth.service, auth.user.id)
  ]);

  if (ticketError) return NextResponse.json({ error: "Tickets indisponibles." }, { status: 503 });
  return NextResponse.json({ health, tickets: tickets || [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const auth = await context(request);
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const category = typeof body?.category === "string" ? body.category : "other";
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const preferredSiteId = typeof body?.siteId === "string" ? body.siteId : null;

  if (!categories.has(category) || subject.length < 3 || subject.length > 160 || message.length < 10 || message.length > 4000) {
    return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
  }

  const since = new Date(Date.now() - 60_000).toISOString();
  const [{ count: recentCount, error: recentError }, { count: openCount, error: openError }] = await Promise.all([
    auth.service
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", auth.user.id)
      .gte("created_at", since),
    auth.service
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", auth.user.id)
      .not("status", "in", '("resolved","closed")')
  ]);

  if (recentError || openError) {
    return NextResponse.json({ error: "Contrôle du support indisponible." }, { status: 503 });
  }
  if ((recentCount || 0) >= 3) {
    return NextResponse.json({ error: "Trop de demandes rapprochées. Réessayez dans une minute." }, { status: 429 });
  }
  if ((openCount || 0) >= 25) {
    return NextResponse.json({ error: "Trop de demandes sont déjà ouvertes sur ce compte." }, { status: 429 });
  }

  const health = await diagnoseSupportHealth(auth.service, auth.user.id, preferredSiteId);
  const incident = health.diagnosis.overall === "incident";
  const waitingCustomer = !incident && Boolean(health.diagnosis.clientAction);
  const status = waitingCustomer ? "waiting_customer" : "diagnosed";
  const severity = incident ? "high" : "normal";

  const { data: ticket, error } = await auth.service
    .from("support_tickets")
    .insert({
      user_id: auth.user.id,
      site_id: health.siteId,
      category,
      severity,
      subject,
      message,
      status,
      diagnosis: health.diagnosis,
      client_action: health.diagnosis.clientAction
    })
    .select("id,site_id,category,severity,subject,message,status,diagnosis,client_action,resolution_code,created_at,updated_at,resolved_at")
    .single();

  if (error || !ticket) return NextResponse.json({ error: "Création du ticket impossible." }, { status: 503 });

  await recordSupportEvent(auth.service, {
    ticketId: ticket.id,
    actor: "client",
    type: "created",
    metadata: {
      category: ticket.category,
      status: ticket.status,
      severity: ticket.severity,
      diagnosis: health.diagnosis.overall
    }
  });

  return NextResponse.json({ ticket, health }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}


export async function PATCH(request: Request) {
  const auth = await context(request);
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ error: "Ticket invalide." }, { status: 400 });
  }

  const { data: current, error: currentError } = await auth.service
    .from("support_tickets")
    .select("id,user_id,site_id,status,created_at")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (currentError) {
    return NextResponse.json({ error: "Ticket indisponible." }, { status: 503 });
  }
  if (!current) {
    return NextResponse.json({ error: "Ticket introuvable." }, { status: 404 });
  }
  if (current.status !== "waiting_customer") {
    return NextResponse.json(
      { error: "Ce ticket n’attend plus une action de votre part." },
      { status: 409 }
    );
  }

  const health = await diagnoseSupportHealth(
    auth.service,
    auth.user.id,
    current.site_id
  );
  const createdAt = Date.parse(current.created_at);
  const ageHours = Number.isFinite(createdAt)
    ? Math.max(0, (Date.now() - createdAt) / (60 * 60 * 1000))
    : 72;
  const decision = supportReconcileDecision({
    overall: health.diagnosis.overall,
    clientAction: health.diagnosis.clientAction,
    ageHours
  });
  const now = new Date().toISOString();

  const patch: Record<string, unknown> = {
    status: decision.status,
    diagnosis: health.diagnosis,
    client_action: health.diagnosis.clientAction,
    resolution_code: decision.resolutionCode,
    resolved_at: decision.resolved ? now : null,
    updated_at: now
  };
  if (decision.severity) patch.severity = decision.severity;

  const { data: ticket, error: updateError } = await auth.service
    .from("support_tickets")
    .update(patch)
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .eq("status", "waiting_customer")
    .select("id,site_id,category,severity,subject,message,status,diagnosis,client_action,resolution_code,created_at,updated_at,resolved_at")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: "Nouveau diagnostic impossible." }, { status: 503 });
  }
  if (!ticket) {
    return NextResponse.json(
      { error: "Le ticket a été modifié pendant le diagnostic. Actualisez la page." },
      { status: 409 }
    );
  }

  await recordSupportEvent(auth.service, {
    ticketId: ticket.id,
    actor: "client",
    type: decision.resolved ? "resolution" : "diagnostic",
    metadata: {
      previous_status: current.status,
      status: ticket.status,
      diagnosis: health.diagnosis.overall,
      resolution_code: ticket.resolution_code
    }
  });

  return NextResponse.json(
    { ticket, health },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
