export type CostDimension = {
  totalRows: number;
  rows: Array<{ key: string; costMicros: number; calls: number; uncertainCalls: number }>;
};

export type AiRequestEfficiency = {
  status: "complete" | "truncated" | "unavailable";
  groups: Array<{
    operation: string; attempts: number; delivered: number; failed: number;
    unknownOutcomes: number; calls: number; uncertainCalls: number;
    chargedMicros: number; failedCostMicros: number;
    costPerDeliveredMicros: number | null;
  }>;
};

// Root-request cohort, not calendar-month spend. All internal calls and failed
// attempts stay in the numerator; technical delivery is not human acceptance.
export function summarizeAiRequestEfficiency(rows: unknown, count: unknown): AiRequestEfficiency {
  const unavailable: AiRequestEfficiency = { status: "unavailable", groups: [] };
  if (!Array.isArray(rows) || !Number.isSafeInteger(count) || (count as number) < 0) return unavailable;
  if (rows.length < (count as number)) return { status: "truncated", groups: [] };
  if (rows.length !== count) return unavailable;
  const requests = new Map<string, { operation: string; outcome: string | null; cost: number; calls: number; uncertain: number }>();
  const safe = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
  for (const row of rows) {
    const operation = row?.root_operation ?? row?.operation;
    if (!row || typeof row.request_id !== "string" || !row.request_id.trim() ||
        typeof operation !== "string" || !operation.trim() || !safe(row.charged_micros) ||
        !["settled", "reserved", "uncertain"].includes(row.state) ||
        ![null, "started", "completed", "failed"].includes(row.root_state)) return unavailable;
    const previous = requests.get(row.request_id);
    if (previous && (previous.operation !== operation || previous.outcome !== row.root_state)) return unavailable;
    const request = previous || { operation, outcome: row.root_state, cost: 0, calls: 0, uncertain: 0 };
    request.cost += row.charged_micros;
    if (!safe(request.cost)) return unavailable;
    request.calls++;
    if (row.state !== "settled") request.uncertain++;
    requests.set(row.request_id, request);
  }
  const groups = new Map<string, AiRequestEfficiency["groups"][number]>();
  for (const request of requests.values()) {
    const group = groups.get(request.operation) || { operation: request.operation, attempts: 0,
      delivered: 0, failed: 0, unknownOutcomes: 0, calls: 0, uncertainCalls: 0,
      chargedMicros: 0, failedCostMicros: 0, costPerDeliveredMicros: null };
    group.attempts++; group.calls += request.calls; group.uncertainCalls += request.uncertain;
    group.chargedMicros += request.cost;
    if (request.outcome === "completed") group.delivered++;
    else if (request.outcome === "failed") { group.failed++; group.failedCostMicros += request.cost; }
    else group.unknownOutcomes++;
    if (!safe(group.chargedMicros) || !safe(group.failedCostMicros)) return unavailable;
    groups.set(request.operation, group);
  }
  return { status: "complete", groups: [...groups.values()].sort((a,b) => a.operation.localeCompare(b.operation)).map(group => ({
    ...group,
    costPerDeliveredMicros: group.delivered > 0 && !group.uncertainCalls && !group.unknownOutcomes
      ? group.chargedMicros / group.delivered : null
  })) };
}

export type AiFinopsReport = {
  month: string;
  currency: "USD";
  totalCostMicros: number;
  calls: number;
  uncertainCalls: number;
  legacyUnlinkedCalls: number;
  dimensions: Record<string, CostDimension>;
  requests: Array<{
    operation: string; attempts: number; measuredSuccesses: number;
    meanMicros: number | null; p95Micros: number | null; failedCostMicros: number; unknownOutcomes?: number;
  }>;
  planAccounts: Array<{
    plan: string; accountsWithAi: number;
    meanMicros: number | null; medianMicros: number | null; p95Micros: number | null;
  }>;
  launchRights: {
    measuredRights: number; completedRights: number;
    meanToDateMicros: number | null; p95ToDateMicros: number | null; meanCompletedMicros: number | null;
  };
  policy: {
    ai_enabled: boolean; heavy_enabled: boolean;
    global_daily_micros: number; global_monthly_micros: number;
  };
  budgetExposure: { dayMicros: number; monthMicros: number };
};

export type FinopsAlert = {
  key: string;
  level: "info" | "warning" | "critical";
  message: string;
};

export type FinopsMonitorStatus = {
  lastRunAt: string | null;
  activeAlerts: number;
  items: Array<{
    id: number; scope: string; subject_key: string; kind: string; threshold: number;
    level: "info" | "warning" | "critical"; used_micros: number; cap_micros: number; last_seen_at: string;
  }>;
};

export function finopsMonitorLabel(kind: string): string {
  return ({ daily: "Budget global quotidien", monthly: "Budget global mensuel", aggregate_monthly: "Budget total du compte", run_monthly: "Budget RUN mensuel", launch_lifetime: "Budget cumulé BUILD", stale_provision: "Provision fournisseur à rapprocher", ai_paused: "IA suspendue", heavy_paused: "Opérations lourdes suspendues" } as Record<string, string>)[kind] || "Coût à vérifier";
}

export function finopsMonth(value: string | null, now = new Date()): string {
  const current = now.toISOString().slice(0, 7);
  const month = value ?? current;
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month) || month > current) {
    throw new Error("invalid_finops_month");
  }
  return month;
}

export function usdCost(micros: number | null): string {
  if (micros === null) return "Non mesuré";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD", minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(micros / 1_000_000);
}

// Exposure mirrors budget admission, including provisions from earlier periods.
// It is always live, even when the report displays a historical month.
export function finopsAlerts(report: AiFinopsReport): FinopsAlert[] {
  const alerts: FinopsAlert[] = [];
  for (const [key, used, cap, label] of [
    ["daily", report.budgetExposure.dayMicros, report.policy.global_daily_micros, "quotidien"],
    ["monthly", report.budgetExposure.monthMicros, report.policy.global_monthly_micros, "mensuel"]
  ] as const) {
    const ratio = cap > 0 ? used / cap : 1;
    const threshold = [100, 90, 75, 50].find(value => ratio >= value / 100);
    if (threshold !== undefined) alerts.push({
      key, level: threshold >= 90 ? "critical" : threshold >= 75 ? "warning" : "info",
      message: cap === 0
        ? `Budget ${label} AJG désactivé : aucun nouvel appel autorisé.`
        : `Budget ${label} AJG : seuil de ${threshold} % atteint (${usdCost(used)} / ${usdCost(cap)}).`
    });
  }
  if (!report.policy.ai_enabled) alerts.push({ key: "ai-paused", level: "critical", message: "Toutes les fonctions IA sont suspendues ; les sites restent disponibles." });
  else if (!report.policy.heavy_enabled) alerts.push({ key: "heavy-paused", level: "warning", message: "Les opérations IA lourdes sont suspendues ; l’édition manuelle et l’IA légère restent disponibles." });
  if (report.uncertainCalls > 0) alerts.push({ key: "uncertain", level: "warning", message: `${report.uncertainCalls} appel(s) avec provision ou tarif inconnu. Rapprocher avec le fournisseur avant de libérer un budget.` });
  if (report.legacyUnlinkedCalls > 0) alerts.push({ key: "legacy", level: "info", message: `${report.legacyUnlinkedCalls} appel(s) historique(s) non rattachés à une génération complète : exclus de son coût moyen et P95.` });
  return alerts;
}
