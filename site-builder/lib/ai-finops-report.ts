export type CostDimension = {
  totalRows: number;
  rows: Array<{ key: string; costMicros: number; calls: number; uncertainCalls: number }>;
};

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
