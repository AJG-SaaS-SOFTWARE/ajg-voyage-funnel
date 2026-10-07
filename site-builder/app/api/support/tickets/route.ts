import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { diagnoseSupportHealth } from "../../../../lib/support-health-server";
import { supportReconcileDecision } from "../../../../lib/support-reconcile-policy";
import { recordSupportEvent } from "../../../../lib/support-events";
import { reportSupportTicketToRun } from "../../../../lib/run-intake-reporting";
import { localize, requestProductLocale } from "../../../../lib/server-locale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const categories = new Set(["bug","domain","publication","billing","ai","data","other"]);
const ticketColumns = "id,site_id,category,severity,subject,message,status,diagnosis,client_action,resolution_code,created_at,updated_at,resolved_at";
const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function bearer(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
}

async function context(request: Request) {
  const locale = requestProductLocale(request);
  const tr = (fr: string, en: string) => localize(locale, fr, en);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = bearer(request);
  if (!url || !publishable || !serviceKey) return { response: NextResponse.json({ error: tr("Support indisponible.", "Support unavailable.") }, { status: 503 }) };
  if (!token) return { response: NextResponse.json({ error: tr("Connexion requise.", "Sign-in required.") }, { status: 401 }) };

  const userClient = createClient(url, publishable, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: { user }, error } = await userClient.auth.getUser(token);
  if (error || !user) return { response: NextResponse.json({ error: tr("Connexion requise.", "Sign-in required.") }, { status: 401 }) };

  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return { user, service, tr };
}

export async function GET(request: Request) {
  const auth = await context(request);
  if ("response" in auth) return auth.response;
  const tr = auth.tr;

  const [{ data: tickets, error: ticketError }, health] = await Promise.all([
    auth.service
      .from("support_tickets")
      .select("id,site_id,category,severity,subject,message,status,diagnosis,client_action,resolution_code,created_at,updated_at,resolved_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    diagnoseSupportHealth(auth.service, auth.user.id)
  ]);

  if (ticketError) return NextResponse.json({ error: tr("Tickets indisponibles.", "Tickets unavailable.") }, { status: 503 });
  return NextResponse.json({ health, tickets: tickets || [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const auth = await context(request);
  if ("response" in auth) return auth.response;
  const tr = auth.tr;

  const body = await request.json().catch(() => null);
  const category = typeof body?.category === "string" ? body.category : "other";
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const preferredSiteId = typeof body?.siteId === "string" ? body.siteId : null;
  const requestId = typeof body?.requestId === "string" ? body.requestId.toLowerCase() : null;

  if ((body?.requestId !== undefined && (!requestId || !requestIdPattern.test(requestId)))
    || !categories.has(category) || subject.length < 3 || subject.length > 160 || message.length < 10 || message.length > 4000) {
    return NextResponse.json({ error: tr("Demande invalide.", "Invalid request.") }, { status: 400 });
  }

  // This is a lookup of the authenticated owner's ticket, never an upsert.
  // A missing row is not proof that an earlier request has stopped remotely.
  const service = auth.service;
  const userId = auth.user.id;
  async function replay() {
    if (!requestId) return null;
    const { data: existing, error: lookupError } = await service
      .from("support_tickets")
      .select(ticketColumns)
      .eq("id", requestId)
      .eq("user_id", userId)
      .maybeSingle();
    if (lookupError) {
      return NextResponse.json({ error: tr("Vérification de la demande indisponible.", "Request verification unavailable.") }, { status: 503 });
    }
    if (!existing) return null;
    if (existing.category !== category || existing.subject !== subject || existing.message !== message
      || (preferredSiteId !== null && existing.site_id !== preferredSiteId)) {
      return NextResponse.json({ error: tr("Cette référence correspond à une autre demande. Actualisez vos demandes.", "This reference belongs to a different request. Refresh your requests.") }, { status: 409 });
    }
    return NextResponse.json({
      ticket: existing,
      health: { siteId: existing.site_id, diagnosis: existing.diagnosis },
      replayed: true
    }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  }

  const previous = await replay();
  if (previous) return previous;

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
    return NextResponse.json({ error: tr("Contrôle du support indisponible.", "Support checks unavailable.") }, { status: 503 });
  }
  if ((recentCount || 0) >= 3) {
    return NextResponse.json({ error: tr("Trop de demandes rapprochées. Réessayez dans une minute.", "Too many requests in a short period. Try again in one minute.") }, { status: 429 });
  }
  if ((openCount || 0) >= 25) {
    return NextResponse.json({ error: tr("Trop de demandes sont déjà ouvertes sur ce compte.", "Too many requests are already open on this account.") }, { status: 429 });
  }

  const health = await diagnoseSupportHealth(auth.service, auth.user.id, preferredSiteId);
  const incident = health.diagnosis.overall === "incident";
  const waitingCustomer = !incident && Boolean(health.diagnosis.clientAction);
  const status = waitingCustomer ? "waiting_customer" : "diagnosed";
  const severity = incident ? "high" : "normal";

  const { data: ticket, error } = await auth.service
    .from("support_tickets")
    .insert({
      ...(requestId ? { id: requestId } : {}),
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

  if (error || !ticket) {
    // Covers both a concurrent primary-key conflict and a lost insert response.
    // Never generate a different ID or replay downstream effects here.
    const recovered = await replay();
    if (recovered) return recovered;
    return NextResponse.json({ error: tr("Création du ticket non confirmée. Vérifiez vos demandes avant de réessayer.", "Ticket creation could not be confirmed. Check your requests before trying again.") }, { status: 503 });
  }

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

  await reportSupportTicketToRun({
    category: ticket.category,
    severity: ticket.severity,
    status: ticket.status,
    diagnosis: health.diagnosis.overall,
    sitePresent: Boolean(ticket.site_id),
    ticketId: String(ticket.id),
  });

  return NextResponse.json({ ticket, health }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}


export async function PATCH(request: Request) {
  const auth = await context(request);
  if ("response" in auth) return auth.response;
  const tr = auth.tr;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ error: tr("Ticket invalide.", "Invalid ticket.") }, { status: 400 });
  }

  const { data: current, error: currentError } = await auth.service
    .from("support_tickets")
    .select("id,user_id,site_id,status,created_at")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (currentError) {
    return NextResponse.json({ error: tr("Ticket indisponible.", "Ticket unavailable.") }, { status: 503 });
  }
  if (!current) {
    return NextResponse.json({ error: tr("Ticket introuvable.", "Ticket not found.") }, { status: 404 });
  }
  if (current.status !== "waiting_customer") {
    return NextResponse.json(
      { error: tr("Ce ticket n’attend plus une action de votre part.", "This ticket no longer requires an action from you.") },
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
    return NextResponse.json({ error: tr("Nouveau diagnostic impossible.", "Unable to run a new diagnosis.") }, { status: 503 });
  }
  if (!ticket) {
    return NextResponse.json(
      { error: tr("Le ticket a été modifié pendant le diagnostic. Actualisez la page.", "The ticket changed during diagnosis. Refresh the page.") },
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
