type BuilderRunInput = {
  category: string;
  severity: string;
  status: string;
  diagnosis: string;
  sitePresent: boolean;
  ticketId: string;
};

export async function reportSupportTicketToRun(input: BuilderRunInput) {
  const token = process.env.AJG_RUN_TOKEN?.trim();
  if (!token) return { ok: false as const, reason: "run intake not configured" };

  const priority =
    input.severity === "critical"
      ? "critical"
      : input.severity === "high"
        ? "high"
        : "normal";

  const payload = {
    product: "ELTARA",
    title: `support · ${input.category}`.slice(0, 160),
    detail: [
      `severity=${input.severity}`,
      `status=${input.status}`,
      `diagnosis=${input.diagnosis}`,
      `site=${input.sitePresent ? "yes" : "no"}`,
    ].join(" · "),
    source: "builder-support",
    externalRef: `builder-ticket:${input.ticketId}`,
    kind: input.diagnosis === "incident" ? "incident" : "support",
    priority,
  };

  try {
    const response = await fetch(
      "https://ajg-infra-cockpit.vercel.app/api/run/intake",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: AbortSignal.timeout(2_500),
      },
    );
    return response.ok
      ? { ok: true as const }
      : { ok: false as const, reason: `HTTP ${response.status}` };
  } catch {
    return { ok: false as const, reason: "run intake unavailable" };
  }
}


type BuilderRuntimeRunInput = {
  deploymentId: string | null;
  runtimeStatus: "healthy" | "warning" | "incident" | "unknown";
  errorCount: number;
  fatalCount: number;
  http5xxCount: number;
  source?: string;
};

export async function reportRuntimeIncidentToRun(input: BuilderRuntimeRunInput) {
  if (input.runtimeStatus !== "incident") {
    return { ok: true as const, skipped: true as const };
  }

  const token = process.env.AJG_RUN_TOKEN?.trim();
  if (!token) return { ok: false as const, reason: "run intake not configured" };

  const externalRef = input.deploymentId
    ? `builder-runtime:${input.deploymentId}`
    : `builder-runtime:unknown`;

  const payload = {
    product: "ELTARA",
    title: "runtime · incident production",
    detail: [
      `status=${input.runtimeStatus}`,
      `errors=${input.errorCount}`,
      `fatal=${input.fatalCount}`,
      `http5xx=${input.http5xxCount}`,
      `deployment=${input.deploymentId || "unknown"}`
    ].join(" · "),
    source: input.source || "builder-runtime-agent",
    externalRef,
    kind: "incident",
    priority: input.fatalCount > 0 || input.http5xxCount >= 10 ? "critical" : "high"
  };

  try {
    const response = await fetch(
      "https://ajg-infra-cockpit.vercel.app/api/run/intake",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: AbortSignal.timeout(2_500)
      }
    );
    return response.ok
      ? { ok: true as const, skipped: false as const }
      : { ok: false as const, reason: `HTTP ${response.status}` };
  } catch {
    return { ok: false as const, reason: "run intake unavailable" };
  }
}
