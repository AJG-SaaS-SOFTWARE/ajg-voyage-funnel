export type VercelDomainKind = "managed_subdomain" | "custom_domain";

export type DomainDnsInstruction = {
  type?: string;
  domain?: string;
  value?: string;
  reason?: string;
};

export type VercelDomainSyncResult = {
  verified: boolean;
  ownershipVerified: boolean;
  misconfigured: boolean | null;
  verification: DomainDnsInstruction[];
};

export class VercelDomainSyncError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 502, code = "vercel_domain_sync_failed") {
    super(message);
    this.name = "VercelDomainSyncError";
    this.status = status;
    this.code = code;
  }
}

export async function syncVercelDomain(
  hostname: string,
  kind: VercelDomainKind
): Promise<VercelDomainSyncResult> {
  const token = process.env.VERCEL_TOKEN;
  const project =
    process.env.VERCEL_PROJECT_ID || "prj_RUtVL1fXzOqY8dHetb6U2dp07Ygn";
  const team =
    process.env.VERCEL_TEAM_ID || "team_T1xBMzY6HJCAkUStrmkUgj60";

  if (!token) {
    throw new VercelDomainSyncError(
      "Domain automation not configured",
      503,
      "vercel_token_missing"
    );
  }

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
  const projectDomainUrl =
    `https://api.vercel.com/v9/projects/${encodeURIComponent(project)}/domains/${encodeURIComponent(hostname)}?teamId=${encodeURIComponent(team)}`;

  let existingRes = await fetch(projectDomainUrl, {
    headers: authHeaders,
    cache: "no-store"
  });
  let projectDomain: any = existingRes.ok
    ? await existingRes.json().catch(() => ({}))
    : null;

  if (!existingRes.ok) {
    const endpoint =
      `https://api.vercel.com/v10/projects/${encodeURIComponent(project)}/domains?teamId=${encodeURIComponent(team)}`;
    const attachRes = await fetch(endpoint, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: hostname }),
      cache: "no-store"
    });
    const attachResult: any = await attachRes.json().catch(() => ({}));

    if (attachRes.ok) {
      projectDomain = attachResult;
    } else {
      existingRes = await fetch(projectDomainUrl, {
        headers: authHeaders,
        cache: "no-store"
      });

      if (existingRes.ok) {
        projectDomain = await existingRes.json().catch(() => ({}));
      } else {
        const code =
          attachResult?.error?.code ||
          attachResult?.code ||
          "vercel_domain_attach_failed";
        const message =
          attachResult?.error?.message ||
          attachResult?.message ||
          "Vercel refuse le rattachement de ce domaine.";
        throw new VercelDomainSyncError(message, attachRes.status || 502, code);
      }
    }
  }

  const verify = await fetch(
    `https://api.vercel.com/v9/projects/${encodeURIComponent(project)}/domains/${encodeURIComponent(hostname)}/verify?teamId=${encodeURIComponent(team)}`,
    { method: "POST", headers: authHeaders, cache: "no-store" }
  );
  const verification: any = await verify.json().catch(() => ({}));
  const ownershipVerified = Boolean(verification?.verified);

  const configRes = await fetch(
    `https://api.vercel.com/v6/domains/${encodeURIComponent(hostname)}/config?projectIdOrName=${encodeURIComponent(project)}&teamId=${encodeURIComponent(team)}`,
    {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store"
    }
  );
  const config: any = await configRes.json().catch(() => ({}));
  const verified =
    ownershipVerified && configRes.ok && config?.misconfigured === false;

  const dnsInstructions: DomainDnsInstruction[] = [];
  const addValues = (type: string, items: unknown) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      const value =
        typeof item === "string"
          ? item
          : (item as any)?.value ||
            (item as any)?.target ||
            (item as any)?.cname ||
            (item as any)?.address;
      if (value) {
        dnsInstructions.push({
          type,
          domain: hostname,
          value: String(value)
        });
      }
    }
  };

  addValues("CNAME", config?.recommendedCNAME);
  if (kind === "custom_domain") addValues("A", config?.recommendedIPv4);

  if (kind === "managed_subdomain" && dnsInstructions.length > 1) {
    const projectSpecific = dnsInstructions.find(
      (item) =>
        item.type === "CNAME" && item.value?.includes(".vercel-dns-")
    );
    if (projectSpecific) {
      dnsInstructions.splice(0, dnsInstructions.length, projectSpecific);
    } else {
      dnsInstructions.splice(1);
    }
  }

  if (config?.misconfigured === true && !dnsInstructions.length) {
    dnsInstructions.push({
      type: "DNS",
      domain: hostname,
      reason: "Configuration DNS Vercel encore incomplète."
    });
  }

  return {
    verified,
    ownershipVerified,
    misconfigured: config?.misconfigured ?? null,
    verification: verified
      ? []
      : dnsInstructions.length
        ? dnsInstructions
        : verification?.verification || projectDomain?.verification || []
  };
}
