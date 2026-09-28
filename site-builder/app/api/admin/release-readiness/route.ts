import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckStatus = "pass" | "warn" | "blocker" | "deferred";
type CheckScope = "beta" | "commercial";

type ReadinessCheck = {
  key: string;
  label: string;
  status: CheckStatus;
  scope: CheckScope;
  detail: string;
};

function bearer(request: Request) {
  const value = request.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

function present(value: string | undefined) {
  return Boolean(value && value.trim());
}

function check(
  key: string,
  label: string,
  ok: boolean,
  scope: CheckScope,
  detailOk: string,
  detailMissing: string,
  missingStatus: CheckStatus = "blocker"
): ReadinessCheck {
  return {
    key,
    label,
    status: ok ? "pass" : missingStatus,
    scope,
    detail: ok ? detailOk : detailMissing
  };
}

export async function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !publishable) {
    return NextResponse.json(
      { error: "Admin diagnostics unavailable" },
      { status: 503 }
    );
  }

  const token = bearer(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userClient = createClient(supabaseUrl, publishable, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser(token);
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: role, error: roleError } = await userClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleError || role?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  const checks: ReadinessCheck[] = [
    check(
      "supabase-public",
      "Supabase · configuration publique",
      present(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
        present(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      "beta",
      "URL projet et clé publique configurées.",
      "URL Supabase ou clé publique manquante."
    ),
    check(
      "supabase-server",
      "Supabase · secret serveur",
      present(serviceKey),
      "beta",
      "Secret serveur présent.",
      "SUPABASE_SECRET_KEY manque côté serveur."
    ),
    check(
      "openai",
      "Assistant IA",
      present(process.env.OPENAI_API_KEY),
      "beta",
      "Clé serveur OpenAI présente.",
      "OPENAI_API_KEY manque : les fonctions IA serveur seront indisponibles."
    ),
    check(
      "resend",
      "Notifications email",
      present(process.env.RESEND_API_KEY) && present(process.env.RESEND_FROM_EMAIL),
      "beta",
      "Resend et adresse expéditeur configurés.",
      "RESEND_API_KEY ou RESEND_FROM_EMAIL manque.",
      "warn"
    ),
    check(
      "cron",
      "Worker de notifications",
      present(process.env.CRON_SECRET),
      "beta",
      "CRON_SECRET présent.",
      "CRON_SECRET manque : le worker planifié ne peut pas être sécurisé.",
      "warn"
    ),
    check(
      "vercel-domain",
      "Domaines personnalisés",
      present(process.env.VERCEL_TOKEN) &&
        present(process.env.VERCEL_PROJECT_ID) &&
        present(process.env.VERCEL_TEAM_ID),
      "beta",
      "Jeton et identifiants Vercel présents.",
      "VERCEL_TOKEN / PROJECT_ID / TEAM_ID incomplets : l’automatisation DNS reste inactive.",
      "warn"
    ),
    check(
      "app-url",
      "URL applicative",
      present(process.env.NEXT_PUBLIC_APP_URL),
      "beta",
      "URL publique de l’application configurée.",
      "NEXT_PUBLIC_APP_URL manque.",
      "warn"
    ),
    check(
      "billing-provider",
      "Fournisseur de paiement",
      present(process.env.BILLING_PROVIDER_WEBHOOK_SECRET),
      "commercial",
      "Secret d’adaptateur de paiement présent.",
      "Secret fournisseur non configuré tant que le paiement réel reste volontairement désactivé.",
      "deferred"
    )
  ];

  if (!present(process.env.VERCEL_GIT_COMMIT_SHA)) {
    checks.push({
      key: "deployment-sha",
      label: "Révision déployée",
      status: "warn",
      scope: "beta",
      detail: "Aucun SHA Vercel détecté dans cet environnement."
    });
  } else {
    checks.push({
      key: "deployment-sha",
      label: "Révision déployée",
      status: "pass",
      scope: "beta",
      detail: `Commit Vercel détecté : ${process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12)}…`
    });
  }

  if (serviceKey) {
    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    for (const bucket of [
      { id: "site-media", label: "Storage public", required: true },
      { id: "site-private-media", label: "Storage privé", required: true }
    ]) {
      const { data, error } = await service.storage.getBucket(bucket.id);
      checks.push({
        key: "bucket-" + bucket.id,
        label: bucket.label,
        scope: "beta",
        status: data ? "pass" : error ? "blocker" : "blocker",
        detail: data
          ? `Bucket ${bucket.id} disponible (${data.public ? "public" : "privé"}).`
          : `Bucket ${bucket.id} absent ou inaccessible.`
      });
    }

    const privateBucketReady = checks.some(
      (item) => item.key === "bucket-site-private-media" && item.status === "pass"
    );
    const bootstrapSecret = present(process.env.STORAGE_BOOTSTRAP_SECRET);
    checks.push({
      key: "storage-bootstrap-secret",
      label: "Secret bootstrap Storage",
      scope: "beta",
      status: privateBucketReady
        ? bootstrapSecret
          ? "warn"
          : "pass"
        : bootstrapSecret
          ? "pass"
          : "blocker",
      detail: privateBucketReady
        ? bootstrapSecret
          ? "Le bucket privé existe : retirez STORAGE_BOOTSTRAP_SECRET après recette du bootstrap."
          : "Bucket privé présent et secret one-shot retiré."
        : bootstrapSecret
          ? "Secret one-shot présent pour initialiser le bucket privé."
          : "Bucket privé absent et STORAGE_BOOTSTRAP_SECRET manque."
    });
  } else {
    checks.push({
      key: "storage-verification",
      label: "Vérification Storage",
      status: "blocker",
      scope: "beta",
      detail: "Impossible de vérifier les buckets sans secret serveur Supabase."
    });
  }

  const summary = checks.reduce(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    { pass: 0, warn: 0, blocker: 0, deferred: 0 }
  );

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
      summary,
      checks
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    }
  );
}
