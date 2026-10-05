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
    .not("status", "in", '("closed")')
    .select("id,status")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: "support sync failed" }, { status: 503 });
  }
  if (!ticket) {
    return NextResponse.json({ ok: true, changed: false });
  }

  await recordSupportEvent(service, {
    ticketId: id,
    actor: "system",
    type: status === "resolved" ? "resolution" : "diagnostic",
    metadata: {
      source: "ajg-run",
      status,
      resolution_code: status === "resolved" ? "run_work_item_closed" : null,
    },
  });

  return NextResponse.json({ ok: true, changed: true, status });
}
