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

  const vercelToken = process.env.VERCEL_TOKEN;
  const vercelProjectId = process.env.VERCEL_PROJECT_ID;
  const vercelTeamId = process.env.VERCEL_TEAM_ID;

  if (!present(vercelToken) || !present(vercelProjectId) || !present(vercelTeamId)) {
    checks.push({
      key: "vercel-domain",
      label: "Vercel · accès API",
      status: "warn",
      scope: "beta",
      detail:
        "VERCEL_TOKEN / PROJECT_ID / TEAM_ID incomplets : domaines personnalisés et vérification active Vercel indisponibles."
    });
  } else {
    try {
      const response = await fetch(
        `https://api.vercel.com/v9/projects/${encodeURIComponent(vercelProjectId!)}?teamId=${encodeURIComponent(vercelTeamId!)}`,
        {
          headers: {
            Authorization: `Bearer ${vercelToken}`,
            Accept: "application/json"
          },
          cache: "no-store",
          signal: AbortSignal.timeout(5000)
        }
      );

      checks.push({
        key: "vercel-domain",
        label: "Vercel · accès API",
        status: response.ok ? "pass" : "warn",
        scope: "beta",
        detail: response.ok
          ? "Jeton serveur validé en lecture sur le projet AJG Site Builder."
          : `Jeton ou périmètre Vercel invalide pour ce projet (HTTP ${response.status}).`
      });
    } catch {
      checks.push({
        key: "vercel-domain",
        label: "Vercel · accès API",
        status: "warn",
        scope: "beta",
        detail: "Impossible de joindre l’API Vercel pendant ce contrôle."
      });
    }
  }

  if (serviceKey) {
    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: managedDomain, error: managedDomainError } = await service
      .from("domains")
      .select("hostname")
      .eq("kind", "managed_subdomain")
      .eq("verification_status", "verified")
      .eq("is_primary", true)
      .limit(1)
      .maybeSingle();

    checks.push({
      key: "managed-subdomains",
      label: "Sous-domaines gérés",
      scope: "beta",
      status: managedDomain && !managedDomainError ? "pass" : "warn",
      detail: managedDomain && !managedDomainError
        ? `Routage automatique actif ; domaine canari vérifié : ${managedDomain.hostname}.`
        : "Aucun sous-domaine AJG vérifié et primaire n'est encore disponible."
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
          : bucket.id === "site-private-media"
            ? "Bucket site-private-media absent : un administrateur peut l’initialiser depuis ce tableau."
            : `Bucket ${bucket.id} absent ou inaccessible.`
      });
    }

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
