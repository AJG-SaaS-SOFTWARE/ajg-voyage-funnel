export type OpenAiRuntimeAudit = {
  status: "pass" | "warn" | "blocker";
  detail: string;
};

const INVALID_CREDENTIAL_CODES = new Set([
  "expired_secret_key",
  "invalid_api_key",
  "invalid_authentication",
  "authentication_error"
]);

const UNAVAILABLE_CODES = new Set([
  ...INVALID_CREDENTIAL_CODES,
  "credit_balance_exhausted",
  "insufficient_quota",
  "billing_hard_limit_reached"
]);

export function isOpenAiUnavailableError(
  code: string | null | undefined,
  status?: number | null
) {
  const normalized = (code || "").trim().toLowerCase();
  return (
    UNAVAILABLE_CODES.has(normalized) ||
    status === 401 ||
    status === 403
  );
}

let cachedAudit:
  | {
      expiresAt: number;
      value: OpenAiRuntimeAudit;
    }
  | null = null;

export async function auditOpenAiRuntime(): Promise<OpenAiRuntimeAudit> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      status: "blocker",
      detail: "OPENAI_API_KEY manque : les fonctions IA serveur sont indisponibles."
    };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json"
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      return {
        status: "pass",
        detail: "Clé OpenAI serveur validée par un contrôle read-only du fournisseur."
      };
    }

    let code = "";
    try {
      const body = await response.json();
      code = typeof body?.error?.code === "string" ? body.error.code : "";
    } catch {
      code = "";
    }

    if (isOpenAiUnavailableError(code, response.status)) {
      return {
        status: "blocker",
        detail:
          "La clé OpenAI configurée est refusée ou n’est plus utilisable. Une rotation manuelle du secret serveur est requise."
      };
    }

    if (response.status === 429) {
      return {
        status: "warn",
        detail:
          "Le fournisseur IA répond mais refuse temporairement le contrôle pour limite de requêtes. Réessayez plus tard."
      };
    }

    return {
      status: response.status >= 500 ? "warn" : "blocker",
      detail:
        response.status >= 500
          ? `Le fournisseur IA est temporairement indisponible (HTTP ${response.status}).`
          : `Le fournisseur IA refuse la configuration runtime (HTTP ${response.status}).`
    };
  } catch {
    return {
      status: "warn",
      detail:
        "Impossible de joindre le fournisseur IA pendant ce contrôle read-only."
    };
  }
}

export async function auditOpenAiRuntimeCached(
  ttlMs = 300_000
): Promise<OpenAiRuntimeAudit> {
  const now = Date.now();
  if (cachedAudit && cachedAudit.expiresAt > now) {
    return cachedAudit.value;
  }

  const value = await auditOpenAiRuntime();
  cachedAudit = {
    expiresAt: now + Math.max(10_000, ttlMs),
    value
  };
  return value;
}
