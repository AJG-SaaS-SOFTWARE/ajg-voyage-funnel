import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  releaseE2ERunDecision,
  type ReleaseE2ERunSnapshot
} from "../../../../lib/release-e2e-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function deploymentSha() {
  return (
    process.env.AJG_RELEASE_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    ""
  ).trim();
}

export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  const sha = deploymentSha();

  if (!url || !publishable || !serviceKey || !sha) {
    return NextResponse.json(
      { error: "Release E2E automation unavailable" },
      { status: 503 }
    );
  }

  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const plans: Array<{
    locale: Locale;
    run: boolean;
    reason: string;
  }> = [];

  for (const locale of ["fr", "en"] as const) {
    const { data, error } = await service
      .from("builder_e2e_runs")
      .select("status,completed_at")
      .eq("deployment_sha", sha)
      .eq("locale", locale)
      .eq("include_ai", true)
      .order("started_at", { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json(
        { error: "Release E2E journal unavailable", locale },
        { status: 503 }
      );
    }

    const decision = releaseE2ERunDecision(
      (data || []) as ReleaseE2ERunSnapshot[]
    );
    plans.push({ locale, run: decision.run, reason: decision.reason });
  }

  const pending = plans.filter((plan) => plan.run);
  if (!pending.length) {
    return NextResponse.json({
      ok: true,
      sha,
      executed: false,
      plans
    });
  }

  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const email = `release-e2e-${sha.slice(0, 12)}-${suffix}@example.invalid`;
  const password =
    crypto.randomUUID().replace(/-/g, "") +
    crypto.randomUUID().replace(/-/g, "");

  let userId = "";
  let cleanupOk = true;
  const results: Array<{
    locale: Locale;
    ok: boolean;
    status: number;
    detail: string;
  }> = [];

  try {
    const { data: created, error: createError } =
      await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          purpose: "eltara_release_e2e",
          deployment_sha: sha
        }
      });

    if (createError || !created.user) {
      throw createError || new Error("temporary_admin_creation_failed");
    }
    userId = created.user.id;

    const { error: roleError } = await service.from("user_roles").insert({
      user_id: userId,
      role: "admin"
    });
    if (roleError) throw roleError;

    const authClient = createClient(url, publishable, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: sessionData, error: signInError } =
      await authClient.auth.signInWithPassword({ email, password });

    const accessToken = sessionData.session?.access_token;
    if (signInError || !accessToken) {
      throw signInError || new Error("temporary_admin_sign_in_failed");
    }

    for (const plan of pending) {
      const response = await fetch(
        new URL("/api/admin/builder-e2e", request.url),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            includeAi: true,
            locale: plan.locale
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(150000)
        }
      );

      const body = await response.json().catch(() => null);
      results.push({
        locale: plan.locale,
        ok: response.ok && body?.ok === true,
        status: response.status,
        detail: response.ok
          ? "validated"
          : String(body?.error || "E2E validation failed").slice(0, 300)
      });
    }
  } catch (error) {
    results.push({
      locale: pending[0]?.locale || "fr",
      ok: false,
      status: 500,
      detail:
        error instanceof Error
          ? error.message.slice(0, 300)
          : "Release E2E automation failed"
    });
  } finally {
    if (userId) {
      const { error: roleCleanupError } = await service
        .from("user_roles")
        .delete()
        .eq("user_id", userId);
      if (roleCleanupError) cleanupOk = false;

      const { error: userCleanupError } =
        await service.auth.admin.deleteUser(userId);
      if (userCleanupError) cleanupOk = false;
    }
  }

  const allOk =
    results.length === pending.length &&
    results.every((result) => result.ok) &&
    cleanupOk;

  return NextResponse.json(
    {
      ok: allOk,
      sha,
      executed: true,
      cleanupOk,
      plans,
      results
    },
    { status: allOk ? 200 : 503 }
  );
}
