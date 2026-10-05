import { createClient } from "@supabase/supabase-js";

export type PrivateBetaGateIssue = {
  key: string;
  detail: string;
};

export type PrivateBetaGateResult = {
  ready: boolean;
  issues: PrivateBetaGateIssue[];
};

function present(value: string | undefined) {
  return Boolean(value && value.trim());
}

export async function evaluatePrivateBetaGate(): Promise<PrivateBetaGateResult> {
  const issues: PrivateBetaGateIssue[] = [];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vercelToken = process.env.VERCEL_TOKEN;
  const vercelProjectId =
    process.env.VERCEL_PROJECT_ID || "prj_RUtVL1fXzOqY8dHetb6U2dp07Ygn";
  const vercelTeamId =
    process.env.VERCEL_TEAM_ID || "team_T1xBMzY6HJCAkUStrmkUgj60";

  if (!present(supabaseUrl) || !present(publishable)) {
    issues.push({
      key: "supabase-public",
      detail: "Configuration publique Supabase incomplète."
    });
  }
  if (!present(serviceKey)) {
    issues.push({
      key: "supabase-server",
      detail: "Secret serveur Supabase absent."
    });
  }
  if (!present(process.env.OPENAI_API_KEY)) {
    issues.push({
      key: "openai",
      detail: "Clé OpenAI serveur absente."
    });
  }
  const deploymentSha =
    process.env.AJG_RELEASE_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA;
  if (!present(deploymentSha)) {
    issues.push({
      key: "deployment-sha",
      detail: "Révision de production courante non détectée."
    });
  }
  if (!present(vercelToken)) {
    issues.push({
      key: "vercel-domain",
      detail: "Token Vercel runtime absent."
    });
  }

  if (!supabaseUrl || !serviceKey) {
    return { ready: false, issues };
  }

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const bucketResults = await Promise.all(
    ["site-media", "site-private-media"].map(async (bucketId) => {
      const { data } = await service.storage.getBucket(bucketId);
      return { bucketId, ok: Boolean(data) };
    })
  );

  for (const bucket of bucketResults) {
    if (!bucket.ok) {
      issues.push({
        key: "bucket-" + bucket.bucketId,
        detail: `Bucket ${bucket.bucketId} indisponible.`
      });
    }
  }

  const { data: managedDomain, error: managedDomainError } = await service
    .from("domains")
    .select("hostname")
    .eq("kind", "managed_subdomain")
    .eq("verification_status", "verified")
    .eq("is_primary", true)
    .limit(1)
    .maybeSingle();

  if (managedDomainError || !managedDomain?.hostname) {
    issues.push({
      key: "managed-subdomains",
      detail: "Aucun sous-domaine ELTARA canari vérifié et primaire."
    });
  } else {
    try {
      const response = await fetch(`https://${managedDomain.hostname}/`, {
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(7000)
      });
      if (response.status < 200 || response.status >= 400) {
        issues.push({
          key: "managed-subdomains",
          detail: `Canari HTTPS inattendu : HTTP ${response.status}.`
        });
      }
    } catch {
      issues.push({
        key: "managed-subdomains",
        detail: "Canari HTTPS ELTARA inaccessible."
      });
    }
  }

  if (vercelToken) {
    try {
      const response = await fetch(
        `https://api.vercel.com/v9/projects/${encodeURIComponent(vercelProjectId)}?teamId=${encodeURIComponent(vercelTeamId)}`,
        {
          headers: {
            Authorization: `Bearer ${vercelToken}`,
            Accept: "application/json"
          },
          cache: "no-store",
          signal: AbortSignal.timeout(5000)
        }
      );

      if (!response.ok) {
        issues.push({
          key: "vercel-domain",
          detail: `Accès projet Vercel refusé (HTTP ${response.status}).`
        });
      }
    } catch {
      issues.push({
        key: "vercel-domain",
        detail: "API Vercel inaccessible pendant le contrôle."
      });
    }
  }

  const unique = new Map(issues.map((item) => [item.key, item]));
  const deduped = [...unique.values()];
  return { ready: deduped.length === 0, issues: deduped };
}
