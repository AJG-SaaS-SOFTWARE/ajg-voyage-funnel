import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const preferredRegion = "cdg1";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return NextResponse.json(
      { ok: false, service: "ajg-site-builder", database: "unconfigured" },
      { status: 503 }
    );
  }

  try {
    const response = await fetch(
      `${url}/rest/v1/sites?select=id&status=eq.published&limit=1`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`
        },
        cache: "no-store",
        signal: AbortSignal.timeout(4000)
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          service: "ajg-site-builder",
          database: "unavailable",
          status: response.status
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        service: "ajg-site-builder",
        database: "ok",
        region: process.env.VERCEL_REGION || "unknown",
        checkedAt: new Date().toISOString()
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch {
    return NextResponse.json(
      { ok: false, service: "ajg-site-builder", database: "unavailable" },
      { status: 503 }
    );
  }
}
