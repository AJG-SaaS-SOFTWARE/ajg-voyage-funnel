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
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
        deployment: {
          commitSha:
            process.env.AJG_RELEASE_SHA ||
            process.env.VERCEL_GIT_COMMIT_SHA ||
            null,
          commitRef: process.env.VERCEL_GIT_COMMIT_REF || null,
          deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null
        },
        region: process.env.VERCEL_REGION || "unknown",
        checkedAt: new Date().toISOString()
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-Content-Type-Options": "nosniff"
        }
      }
    );
  } catch {
    return NextResponse.json(
      { ok: false, service: "ajg-site-builder", database: "unavailable" },
      { status: 503 }
    );
  }
}
