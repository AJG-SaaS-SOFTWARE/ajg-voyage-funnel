export type AiUsageAnomalyStatus = "healthy" | "warning" | "critical" | "unknown";

export type AiUsageAnomaly = {
  status: AiUsageAnomalyStatus;
  checked: boolean;
  windowMinutes: number;
  baselineDays: number;
  currentCalls: number;
  baselineCallsPerHour: number;
  currentCostMicros: number;
  baselineCostMicrosPerHour: number;
  callRatio: number | null;
  costRatio: number | null;
  truncated: boolean;
};

type UsageRow = {
  created_at?: string | null;
  charged_micros?: number | null;
};

const WINDOW_MINUTES = 60;
const BASELINE_DAYS = 7;
const WARNING_MIN_CALLS = 10;
const CRITICAL_MIN_CALLS = 20;
const WARNING_MIN_COST_MICROS = 1_000_000;
const CRITICAL_MIN_COST_MICROS = 3_000_000;

function ratio(current: number, baseline: number) {
  if (baseline <= 0) return current > 0 ? null : 0;
  return current / baseline;
}

export function detectAiUsageAnomaly(
  rows: UsageRow[],
  nowMs = Date.now(),
  truncated = false
): AiUsageAnomaly {
  const currentStart = nowMs - WINDOW_MINUTES * 60_000;
  const baselineStart = currentStart - BASELINE_DAYS * 24 * 60 * 60_000;

  let currentCalls = 0;
  let currentCostMicros = 0;
  let baselineCalls = 0;
  let baselineCostMicros = 0;

  for (const row of rows) {
    const ts = Date.parse(String(row.created_at || ""));
    if (!Number.isFinite(ts) || ts > nowMs + 60_000 || ts < baselineStart) continue;
    const cost = Math.max(0, Number(row.charged_micros) || 0);
    if (ts >= currentStart) {
      currentCalls += 1;
      currentCostMicros += cost;
    } else {
      baselineCalls += 1;
      baselineCostMicros += cost;
    }
  }

  const baselineHours = BASELINE_DAYS * 24;
  const baselineCallsPerHour = baselineCalls / baselineHours;
  const baselineCostMicrosPerHour = baselineCostMicros / baselineHours;
  const callRatio = ratio(currentCalls, baselineCallsPerHour);
  const costRatio = ratio(currentCostMicros, baselineCostMicrosPerHour);

  if (truncated) {
    return {
      status: "unknown",
      checked: false,
      windowMinutes: WINDOW_MINUTES,
      baselineDays: BASELINE_DAYS,
      currentCalls,
      baselineCallsPerHour,
      currentCostMicros,
      baselineCostMicrosPerHour,
      callRatio,
      costRatio,
      truncated: true
    };
  }

  const critical =
    (currentCalls >= CRITICAL_MIN_CALLS && (baselineCallsPerHour <= 0 || currentCalls >= baselineCallsPerHour * 8))
    || (currentCostMicros >= CRITICAL_MIN_COST_MICROS && (baselineCostMicrosPerHour <= 0 || currentCostMicros >= baselineCostMicrosPerHour * 8));
  const warning =
    (currentCalls >= WARNING_MIN_CALLS && (baselineCallsPerHour <= 0 || currentCalls >= baselineCallsPerHour * 4))
    || (currentCostMicros >= WARNING_MIN_COST_MICROS && (baselineCostMicrosPerHour <= 0 || currentCostMicros >= baselineCostMicrosPerHour * 4));

  return {
    status: critical ? "critical" : warning ? "warning" : "healthy",
    checked: true,
    windowMinutes: WINDOW_MINUTES,
    baselineDays: BASELINE_DAYS,
    currentCalls,
    baselineCallsPerHour,
    currentCostMicros,
    baselineCostMicrosPerHour,
    callRatio,
    costRatio,
    truncated: false
  };
}

export function aiUsageAnomalyMessage(anomaly: AiUsageAnomaly): string | null {
  if (anomaly.status === "healthy") return null;
  if (anomaly.status === "unknown") {
    return "Détection de pic IA incomplète : l’échantillon de référence a atteint sa limite de sécurité. Aucun automatisme n’est déclenché.";
  }
  const callBaseline = anomaly.baselineCallsPerHour.toFixed(2);
  const costBaseline = (anomaly.baselineCostMicrosPerHour / 1_000_000).toFixed(4);
  const currentCost = (anomaly.currentCostMicros / 1_000_000).toFixed(4);
  return `Pic d’usage IA ${anomaly.status === "critical" ? "critique" : "inhabituel"} : ${anomaly.currentCalls} appel(s) et $${currentCost} sur la dernière heure, contre une moyenne historique de ${callBaseline} appel(s)/h et $${costBaseline}/h. Vérifier la source avant toute modification de quota.`;
}
