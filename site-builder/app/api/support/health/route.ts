import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { diagnoseSupportHealth } from "../../../../lib/support-health-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearer(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
}

export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = bearer(request);

  if (!url || !publishable || !serviceKey) {
    return NextResponse.json(
      { error: "Diagnostic indisponible." },
      { status: 503 }
    );
  }
  if (!token) {
    return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
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
    return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  }

  const siteId = new URL(request.url).searchParams.get("siteId") || null;
  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const health = await diagnoseSupportHealth(service, user.id, siteId);
  if (siteId && health.siteId !== siteId) {
    return NextResponse.json({ error: "Site introuvable." }, { status: 404 });
  }

  return NextResponse.json(
    { health },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    }
  );
}
