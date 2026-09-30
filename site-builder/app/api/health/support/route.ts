import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SupportOpsStatus = "healthy" | "warning" | "critical";

function response(body: {
  status: SupportOpsStatus | "unknown";
  service: "ajg-site-builder-support";
  summary: string;
  checkedAt: string;
}, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return response({
      status: "unknown",
      service: "ajg-site-builder-support",
      summary: "Signal support indisponible.",
      checkedAt: new Date().toISOString()
    }, 503);
  }

  try {
    const service = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data, error } = await service
      .from("support_tickets")
      .select("severity,status,created_at")
      .in("status", ["new", "diagnosed", "in_progress"])
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) {
      return response({
        status: "unknown",
        service: "ajg-site-builder-support",
        summary: "Signal support indisponible.",
        checkedAt: new Date().toISOString()
      }, 503);
    }

    const rows = data || [];
    if (!rows.length) {
      return response({
        status: "healthy",
        service: "ajg-site-builder-support",
        summary: "Aucune demande ne nécessite actuellement une intervention AJG.",
        checkedAt: new Date().toISOString()
      });
    }

    const now = Date.now();
    const critical = rows.some((ticket) => {
      const ageHours = Math.max(
        0,
        (now - Date.parse(ticket.created_at)) / (60 * 60 * 1000)
      );
      return (
        ticket.severity === "critical" ||
        (ticket.severity === "high" && ageHours >= 24) ||
        ageHours >= 72
      );
    });

    return response({
      status: critical ? "critical" : "warning",
      service: "ajg-site-builder-support",
      summary: critical
        ? "La file de support contient une demande AJG prioritaire ou trop ancienne."
        : "La file de support contient une demande qui nécessite une intervention AJG.",
      checkedAt: new Date().toISOString()
    });
  } catch {
    return response({
      status: "unknown",
      service: "ajg-site-builder-support",
      summary: "Signal support indisponible.",
      checkedAt: new Date().toISOString()
    }, 503);
  }
}
