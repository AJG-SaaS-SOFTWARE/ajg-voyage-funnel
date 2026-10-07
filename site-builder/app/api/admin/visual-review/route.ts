import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SURFACE_SET_VERSION = "customer-core-v1";
type ReviewLocale = "fr" | "en";
type ReviewViewport = "desktop" | "mobile";

function bearer(request: Request) {
  const value = request.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

async function adminContext(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !publishable || !serviceKey) {
    return { error: NextResponse.json({ error: "Visual review unavailable" }, { status: 503 }) };
  }

  const token = bearer(request);
  if (!token) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const userClient = createClient(url, publishable, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const {
    data: { user },
    error: userError
  } = await userClient.auth.getUser(token);
  if (userError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: role, error: roleError } = await userClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleError || role?.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const deploymentSha =
    process.env.AJG_RELEASE_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    "";

  if (!deploymentSha) {
    return {
      error: NextResponse.json(
        { error: "Deployment SHA unavailable" },
        { status: 503 }
      )
    };
  }

  return { service, deploymentSha };
}

export async function GET(request: NextRequest) {
  const context = await adminContext(request);
  if ("error" in context) return context.error;

  const { data, error } = await context.service
    .from("release_visual_reviews")
    .select("locale,viewport,approved,reviewed_at,deployment_sha,surface_set_version")
    .eq("deployment_sha", context.deploymentSha)
    .eq("surface_set_version", SURFACE_SET_VERSION)
    .order("locale", { ascending: true })
    .order("viewport", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Unable to load visual review" }, { status: 500 });
  }

  const reviews = data || [];
  const approvedKeys = new Set(
    reviews
      .filter((item) => item.approved === true)
      .map((item) => `${item.locale}:${item.viewport}`)
  );
  const required = ["fr:desktop", "fr:mobile", "en:desktop", "en:mobile"];

  return NextResponse.json(
    {
      deploymentSha: context.deploymentSha,
      surfaceSetVersion: SURFACE_SET_VERSION,
      complete: required.every((key) => approvedKeys.has(key)),
      reviews
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    }
  );
}

export async function POST(request: NextRequest) {
  const context = await adminContext(request);
  if ("error" in context) return context.error;

  const body = await request.json().catch(() => ({}));
  const locale: ReviewLocale | null =
    body?.locale === "fr" || body?.locale === "en" ? body.locale : null;
  const viewport: ReviewViewport | null =
    body?.viewport === "desktop" || body?.viewport === "mobile"
      ? body.viewport
      : null;
  const approved = body?.approved;

  if (!locale || !viewport || typeof approved !== "boolean") {
    return NextResponse.json({ error: "Invalid visual review payload" }, { status: 400 });
  }

  const reviewedAt = new Date().toISOString();
  const { data, error } = await context.service
    .from("release_visual_reviews")
    .upsert(
      {
        deployment_sha: context.deploymentSha,
        locale,
        viewport,
        surface_set_version: SURFACE_SET_VERSION,
        approved,
        reviewed_at: reviewedAt
      },
      {
        onConflict: "deployment_sha,locale,viewport,surface_set_version"
      }
    )
    .select("locale,viewport,approved,reviewed_at,deployment_sha,surface_set_version")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Unable to save visual review" }, { status: 500 });
  }

  return NextResponse.json(
    { review: data },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    }
  );
}
