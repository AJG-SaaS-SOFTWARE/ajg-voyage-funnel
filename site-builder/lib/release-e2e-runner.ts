import "server-only";

import { createClient } from "@supabase/supabase-js";
import {
  releaseE2ERunDecision,
  type ReleaseE2ERunSnapshot
} from "./release-e2e-policy";

type Locale = "fr" | "en";

export type ReleaseE2EMode = {
  includeAi: boolean;
  label: "structural" | "full";
};

export function currentReleaseSha() {
  return (
    process.env.AJG_RELEASE_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    ""
  ).trim();
}

export async function runReleaseE2EMirror(
  appOrigin: string,
  mode: ReleaseE2EMode
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  const sha = currentReleaseSha();

  if (!url || !publishable || !serviceKey || !sha) {
    return {
      status: 503,
      body: { error: "Release E2E automation unavailable", mode: mode.label }
    };
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
      .eq("include_ai", mode.includeAi)
      .order("started_at", { ascending: false })
      .limit(10);

    if (error) {
      return {
        status: 503,
        body: {
          error: "Release E2E journal unavailable",
          locale,
          mode: mode.label
        }
      };
    }

    const decision = releaseE2ERunDecision(
      (data || []) as ReleaseE2ERunSnapshot[]
    );
    plans.push({ locale, run: decision.run, reason: decision.reason });
  }

  const pending = plans.filter((plan) => plan.run);
  if (!pending.length) {
    return {
      status: 200,
      body: {
        ok: true,
        sha,
        mode: mode.label,
        includeAi: mode.includeAi,
        executed: false,
        plans
      }
    };
  }

  let cleanupOk = true;
  const results: Array<{
    locale: Locale;
    ok: boolean;
    status: number;
    detail: string;
  }> = [];

  for (const plan of pending) {
    const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const email =
      `release-e2e-${mode.label}-${plan.locale}-${sha.slice(0, 12)}-${suffix}@example.invalid`;
    const password =
      crypto.randomUUID().replace(/-/g, "") +
      crypto.randomUUID().replace(/-/g, "");
    let userId = "";

    try {
      const { data: created, error: createError } =
        await service.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            purpose: "eltara_release_e2e",
            deployment_sha: sha,
            locale: plan.locale,
            mode: mode.label
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

      const response = await fetch(
        new URL("/api/admin/builder-e2e", appOrigin),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            includeAi: mode.includeAi,
            locale: plan.locale
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(mode.includeAi ? 150000 : 90000)
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
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message.slice(0, 300)
          : "Release E2E automation failed";

      await service.from("builder_e2e_runs").insert({
        locale: plan.locale,
        include_ai: mode.includeAi,
        deployment_sha: sha,
        status: "failed",
        completed_at: new Date().toISOString(),
        failure_stage: "orchestrator",
        detail,
        steps: []
      });

      results.push({
        locale: plan.locale,
        ok: false,
        status: 500,
        detail
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
        if (userCleanupError) {
          cleanupOk = false;
          await service.from("user_roles").delete().eq("user_id", userId);
          await service.auth.admin.updateUserById(userId, {
            ban_duration: "876000h"
          });
        }
      }
    }
  }

  const allOk =
    results.length === pending.length &&
    results.every((result) => result.ok) &&
    cleanupOk;

  return {
    status: allOk ? 200 : 503,
    body: {
      ok: allOk,
      sha,
      mode: mode.label,
      includeAi: mode.includeAi,
      executed: true,
      cleanupOk,
      plans,
      results
    }
  };
}
