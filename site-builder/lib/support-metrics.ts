export type SupportMetricsTicket = {
  id: string;
  category: string;
  status: string;
  resolution_code: string | null;
  created_at: string;
};

export type SupportMetricsEvent = {
  ticket_id: string;
  actor_type: string;
  event_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type SupportMetricsRemediation = {
  status: string;
  result_code: string;
  trigger_source: string;
  created_at: string;
};

export type SupportMetricsSite = {
  owner_id: string;
};

export type SupportMetrics = {
  windowDays: 30;
  activeClients: number;
  ticketsCreated: number;
  escalatedTickets: number;
  adminTouchedTickets: number;
  autoResolvedTickets: number;
  selfServiceResolvedTickets: number;
  escalatedPerActiveClient: number;
  adminTouchedPerActiveClient: number;
  selfServiceResolutionRate: number;
  byCategory: Array<{ category: string; count: number }>;
  remediation: {
    attempted: number;
    succeeded: number;
    noChange: number;
    failed: number;
    successRate: number;
    byCode: Array<{ code: string; count: number }>;
  };
};

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function countBy(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value || "unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function eventStatus(event: SupportMetricsEvent) {
  const value = event.metadata?.status;
  return typeof value === "string" ? value : "";
}

export function calculateSupportMetrics(input: {
  tickets: SupportMetricsTicket[];
  events: SupportMetricsEvent[];
  remediations: SupportMetricsRemediation[];
  sites: SupportMetricsSite[];
}): SupportMetrics {
  const activeClients = new Set(
    input.sites.map((site) => site.owner_id).filter(Boolean)
  ).size;

  const adminTouched = new Set<string>();
  const escalated = new Set<string>();
  const autoResolved = new Set<string>();

  for (const event of input.events) {
    if (event.actor_type === "admin") {
      adminTouched.add(event.ticket_id);
    }

    const status = eventStatus(event);
    if (status === "diagnosed" || status === "in_progress") {
      escalated.add(event.ticket_id);
    }

    if (
      event.actor_type === "system" &&
      event.event_type === "resolution"
    ) {
      autoResolved.add(event.ticket_id);
    }
  }

  for (const ticket of input.tickets) {
    if (ticket.status === "diagnosed" || ticket.status === "in_progress") {
      escalated.add(ticket.id);
    }
    if (ticket.resolution_code === "auto_health_recovered") {
      autoResolved.add(ticket.id);
    }
  }

  const selfServiceResolved = new Set(
    input.tickets
      .filter(
        (ticket) =>
          ["resolved", "closed"].includes(ticket.status) &&
          !adminTouched.has(ticket.id)
      )
      .map((ticket) => ticket.id)
  );

  for (const ticketId of autoResolved) {
    if (!adminTouched.has(ticketId)) selfServiceResolved.add(ticketId);
  }

  const remediationAttempted = input.remediations.length;
  const remediationSucceeded = input.remediations.filter(
    (row) => row.status === "succeeded"
  ).length;
  const remediationNoChange = input.remediations.filter(
    (row) => row.status === "no_change"
  ).length;
  const remediationFailed = input.remediations.filter(
    (row) => row.status === "failed"
  ).length;

  const categories = countBy(input.tickets.map((ticket) => ticket.category));
  const codes = countBy(
    input.remediations.map((row) => row.result_code || "unknown")
  );

  return {
    windowDays: 30,
    activeClients,
    ticketsCreated: input.tickets.length,
    escalatedTickets: escalated.size,
    adminTouchedTickets: adminTouched.size,
    autoResolvedTickets: autoResolved.size,
    selfServiceResolvedTickets: selfServiceResolved.size,
    escalatedPerActiveClient: ratio(escalated.size, activeClients),
    adminTouchedPerActiveClient: ratio(adminTouched.size, activeClients),
    selfServiceResolutionRate: ratio(
      selfServiceResolved.size,
      input.tickets.length
    ),
    byCategory: categories.map((item) => ({
      category: item.key,
      count: item.count
    })),
    remediation: {
      attempted: remediationAttempted,
      succeeded: remediationSucceeded,
      noChange: remediationNoChange,
      failed: remediationFailed,
      successRate: ratio(remediationSucceeded, remediationAttempted),
      byCode: codes.map((item) => ({ code: item.key, count: item.count }))
    }
  };
}
