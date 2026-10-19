type BuilderRunInput = {
  category: string;
  severity: string;
  status: string;
  diagnosis: string;
  sitePresent: boolean;
  ticketId: string;
};

export async function readSupportTicketInRun(ticketId: string, requestId: string): Promise<{
  status: "open" | "triaged" | "resolved"; resolutionVerified: boolean;
} | null> {
  const token = process.env.AJG_RUN_TOKEN?.trim();
  if (!token || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticketId) ||
      !/^req_[0-9a-f]{8}$/.test(requestId)) return null;
  try {
    const query = new URLSearchParams({ ticketId, requestId });
    const response = await fetch(`https://ajg-infra-cockpit.vercel.app/api/run/intake?${query}`, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store", redirect: "error",
      signal: AbortSignal.timeout(5_000)
    });
    const body = await response.json().catch(() => null);
    const receipt = body?.receipt;
    const valid = response.ok && body?.ok === true && receipt?.requestId === requestId &&
      receipt.ticketId === ticketId && receipt.product === "ELTARA" && receipt.source === "builder-support" &&
      ["open", "triaged", "resolved"].includes(receipt.status) &&
      (receipt.status === "resolved" || receipt.resolutionVerified !== true) &&
      typeof receipt.updatedAt === "string" && Number.isFinite(Date.parse(receipt.updatedAt));
    return valid ? { status: receipt.status, resolutionVerified: receipt.resolutionVerified === true } : null;
  } catch { return null; }
}

export async function verifySupportTicketInRun(ticketId: string, requestId: string, expectedStatus?: "resolved") {
  const receipt = await readSupportTicketInRun(ticketId, requestId);
  return Boolean(receipt && (!expectedStatus || (receipt.status === expectedStatus && receipt.resolutionVerified)));
}

/** Only the persisted intake receipt supplies the central identity; never accept a browser-supplied ID. */
export async function completeVerifiedSupportRepairInRun(
  service: import("@supabase/supabase-js").SupabaseClient, ticketId: string,
) {
  try {
    const receipt = await service.from("support_ticket_events").select("metadata")
      .eq("ticket_id", ticketId).eq("event_type", "diagnostic").eq("metadata->>source", "ajg-run-intake")
      .order("created_at", { ascending: false }).limit(2);
    const ids = new Set((receipt.data || []).map(event => event.metadata?.request_id));
    const requestId = [...ids][0];
    if (receipt.error || ids.size !== 1 || typeof requestId !== "string" || !/^req_[0-9a-f]{8}$/.test(requestId)) return false;
    return await resolveSupportTicketInRun(ticketId, requestId);
  } catch { return false; }
}

/** Signal completion only after product repair; the cockpit independently reads the product audit. */
export async function resolveSupportTicketInRun(ticketId: string, requestId: string) {
  const token = process.env.AJG_RUN_TOKEN?.trim();
  if (!token || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ticketId) ||
      !/^req_[0-9a-f]{8}$/.test(requestId)) return false;
  try {
    const response = await fetch("https://ajg-infra-cockpit.vercel.app/api/run/intake", {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve_support", ticketId, requestId }),
      redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20_000),
    });
    const body = await response.json();
    return response.ok && body?.ok === true && body.requestId === requestId && body.ticketId === ticketId &&
      body.status === "resolved" && body.resolutionVerified === true && await verifySupportTicketInRun(ticketId, requestId, "resolved");
  } catch {
    // A lost response does not prove that persistence failed. Read only; never
    // issue a second completion POST or repeat the underlying product repair.
    return verifySupportTicketInRun(ticketId, requestId, "resolved");
  }
}

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
    if (!response.ok) return { ok: false as const, reason: `HTTP ${response.status}` };
    const body = await response.json().catch(() => null);
    const receipt = body?.request;
    if (body?.ok !== true || !receipt || receipt.product !== payload.product ||
        receipt.source !== payload.source || receipt.externalRef !== payload.externalRef ||
        receipt.title !== payload.title || receipt.kind !== payload.kind ||
        !/^req_[0-9a-f]{8}$/.test(receipt.id || "") ||
        !["open", "triaged"].includes(receipt.status)) {
      return { ok: false as const, reason: "run intake receipt unconfirmed" };
    }
    return { ok: true as const, requestId: receipt.id as string };
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
