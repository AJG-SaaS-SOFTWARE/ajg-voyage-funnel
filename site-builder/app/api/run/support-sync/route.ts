import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { recordSupportEvent } from "../../../../lib/support-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearer(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
}

function authorized(request: Request) {
  const expected = process.env.AJG_RUN_TOKEN?.trim() || "";
  const supplied = bearer(request);
  if (!expected || expected.length !== supplied.length) return false;
  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) {
    diff |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
  }
  return diff === 0;
}

function ticketId(externalRef: unknown) {
  if (typeof externalRef !== "string") return null;
  const match = externalRef.match(
    /^builder-ticket:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i,
  );
  return match?.[1] ?? null;
}

export async function GET(request: Request) {
  if (request && new URL(request.url).search) {
    const reply = (value: unknown, status: number) => NextResponse.json(value, {
      status, headers: { "Cache-Control": "private, no-store" },
    });
    if (!authorized(request)) return reply({ ok: false }, 401);
    const query = new URL(request.url).searchParams;
    const id = ticketId(`builder-ticket:${query.get("ticketId") || ""}`);
    const requestId = query.get("requestId") || "";
    if ([...query].length !== 2 || !id || !/^req_[0-9a-f]{8}$/.test(requestId)) return reply({ ok: false }, 400);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return reply({ ok: false }, 503);
    const service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const ticket = await service.from("support_tickets").select("id,status,resolved_at,resolution_code,updated_at").eq("id", id).maybeSingle();
    if (ticket.error) return reply({ ok: false }, 503);
    if (!ticket.data) return reply({ ok: false }, 404);
    if (!["resolved", "closed"].includes(ticket.data.status) ||
        ticket.data.resolution_code !== "auto_verified_managed_primary_repair" || !ticket.data.resolved_at ||
        !Number.isFinite(Date.parse(ticket.data.resolved_at))) return reply({ ok: false }, 409);
    const [receipt, audit] = await Promise.all([
      service.from("support_ticket_events").select("id").eq("ticket_id", id).eq("event_type", "diagnostic")
        .eq("metadata->>source", "ajg-run-intake").eq("metadata->>request_id", requestId).limit(1),
      service.from("support_ticket_events").select("id,metadata").eq("ticket_id", id).eq("event_type", "resolution")
        .eq("actor_type", "system").eq("metadata->>updated_at", ticket.data.updated_at)
        .eq("metadata->>resolution_code", ticket.data.resolution_code)
        .in("metadata->>status", ["resolved", "closed"]).order("created_at", { ascending: false }).limit(1),
    ]);
    const event = audit.data?.[0];
    const code = event?.metadata?.resolution_code;
    const eventId = String(event?.id ?? "");
    if (receipt.error || audit.error || !receipt.data?.length ||
        (typeof event?.id === "number" && !Number.isSafeInteger(event.id)) ||
        typeof code !== "string" || !/^[a-z][a-z0-9_]{0,119}$/.test(code) ||
        !/^[1-9][0-9]{0,19}$/.test(eventId)) return reply({ ok: false, auditRecorded: false }, 503);
    return reply({ ok: true, auditRecorded: true, proof: { ticketId: id, requestId,
      status: ticket.data.status, resolvedAt: ticket.data.resolved_at, eventId, code } }, 200);
  }
  const tokenConfigured = Boolean(process.env.AJG_RUN_TOKEN?.trim());
  const databaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
  );
  const healthy = tokenConfigured && databaseConfigured;

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "critical",
      summary: healthy
        ? "Synchronisation AJG Run → ELTARA prête."
        : "Synchronisation AJG Run → ELTARA incomplète.",
      configuration: {
        tokenConfigured,
        databaseConfigured,
      },
      supportResolutionProtocol: 1,
    },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const id = ticketId(body?.externalRef);
  const status =
    body?.status === "in_progress" || body?.status === "resolved"
      ? body.status
      : null;
  if (!id || !status) {
    return NextResponse.json({ ok: false, error: "invalid sync payload" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ ok: false, error: "support store unavailable" }, { status: 503 });
  }

  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const now = new Date().toISOString();
  const patch =
    status === "resolved"
      ? {
          status: "resolved",
          resolution_code: "run_work_item_closed",
          client_action: null,
          resolved_at: now,
          updated_at: now,
        }
      : {
          status: "in_progress",
          updated_at: now,
        };

  const { data: ticket, error } = await service
    .from("support_tickets")
    .update(patch)
    .eq("id", id)
    // Terminal tickets stay terminal; duplicate deliveries do not rewrite
    // timestamps or emit another event. The predicate is part of the update.
    .not("status", "in", status === "resolved"
      ? '("closed","resolved")'
      : '("closed","resolved","in_progress")')
    .select("id,status")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: "support sync failed" }, { status: 503 });
  }
  if (!ticket) {
    // A no-op is not proof that the ticket or its resolution audit exists.
    const existing = await service.from("support_tickets").select("id,status")
      .eq("id", id).maybeSingle();
    if (existing.error) return NextResponse.json({ ok: false, error: "support sync read unavailable" }, { status: 503 });
    if (!existing.data) return NextResponse.json({ ok: false, error: "support ticket not found" }, { status: 404 });
    if (status === "resolved") {
      if (!["resolved", "closed"].includes(existing.data.status)) {
        return NextResponse.json({ ok: false, error: "support resolution unconfirmed" }, { status: 409 });
      }
      const audit = await service.from("support_ticket_events").select("id")
        .eq("ticket_id", id).eq("event_type", "resolution")
        .in("metadata->>status", ["resolved", "closed"]).limit(1);
      if (audit.error || !audit.data?.length) {
        return NextResponse.json({ ok: false, changed: false, auditRecorded: false,
          error: "support sync audit unavailable" }, { status: 503 });
      }
      return NextResponse.json({ ok: true, changed: false, status: existing.data.status, auditRecorded: true });
    }
    return NextResponse.json({ ok: true, changed: false, auditRecorded: null });
  }

  let auditRecorded = false;
  try {
    auditRecorded = await recordSupportEvent(service, {
      ticketId: id,
      actor: "system",
      type: status === "resolved" ? "resolution" : "diagnostic",
      metadata: {
        source: "ajg-run",
        status,
        resolution_code: status === "resolved" ? "run_work_item_closed" : null,
      },
    }) === true;
  } catch {
    // The ticket update is already committed. Do not repeat or undo it when
    // the independent audit write fails, and do not expose provider details.
    auditRecorded = false;
  }
  if (!auditRecorded) {
    return NextResponse.json({
      ok: false,
      changed: true,
      status,
      auditRecorded: false,
      error: "support sync audit unavailable",
    }, { status: 503 });
  }

  return NextResponse.json({ ok: true, changed: true, status, auditRecorded: true });
}
