export type AiBenchmarkAttempt = {
  candidate: string;
  task: "assistance" | "diagnostic" | "section" | "creation";
  estimatedUsdMicros: number | null;
  uncertainCeilingUsdMicros: number;
  durationMs: number;
  review: null | {
    reviewer: "human";
    factual: boolean;
    followsRequest: boolean;
    usefulness: number;
    clarity: number;
  };
};

function integer(value: number, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) throw new Error("invalid_benchmark_measurement");
  return value;
}
function percentile(values: number[], fraction: number) {
  const sorted = [...values].sort((a,b) => a-b);
  return sorted[Math.max(0,Math.ceil(sorted.length * fraction)-1)] ?? null;
}

// Costs of failures stay in the numerator. AI self-scores are not human acceptance.
export function summarizeAiBenchmark(attempts: AiBenchmarkAttempt[]) {
  const groups = new Map<string, AiBenchmarkAttempt[]>();
  for (const row of attempts) {
    if (!row.candidate.trim() || !["assistance","diagnostic","section","creation"].includes(row.task)) throw new Error("invalid_benchmark_task");
    integer(row.durationMs); integer(row.uncertainCeilingUsdMicros);
    if (row.estimatedUsdMicros !== null) integer(row.estimatedUsdMicros);
    if (row.review) {
      if (row.review.reviewer !== "human" || typeof row.review.factual !== "boolean" || typeof row.review.followsRequest !== "boolean") throw new Error("invalid_benchmark_review");
      if (integer(row.review.usefulness,1)>5 || integer(row.review.clarity,1)>5) throw new Error("invalid_benchmark_review");
    }
    const key = JSON.stringify([row.candidate,row.task]);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key,[row]);
  }
  return [...groups.values()].map(rows => {
    const reviewed = rows.filter(row => row.review !== null);
    const accepted = reviewed.filter(row => row.review!.factual && row.review!.followsRequest && row.review!.usefulness>=4 && row.review!.clarity>=4);
    const unknownCost = rows.filter(row => row.estimatedUsdMicros === null).length;
    const uncertainCeilingUsdMicros = rows.reduce((sum,row) => sum+row.uncertainCeilingUsdMicros,0);
    const knownEstimatedUsdMicros = rows.reduce((sum,row) => sum+(row.estimatedUsdMicros??0),0);
    return {
      candidate: rows[0].candidate, task: rows[0].task, attempts: rows.length,
      reviewed: reviewed.length, accepted: accepted.length,
      acceptanceRate: reviewed.length ? accepted.length/reviewed.length : null,
      knownEstimatedUsdMicros, uncertainCeilingUsdMicros, unknownCost,
      estimatedUsdMicrosPerAccepted: accepted.length && !unknownCost && !uncertainCeilingUsdMicros ? knownEstimatedUsdMicros/accepted.length : null,
      medianDurationMs: percentile(rows.map(row=>row.durationMs),0.5),
      p95DurationMs: percentile(rows.map(row=>row.durationMs),0.95),
      comparisonReady: reviewed.length===rows.length && !unknownCost && !uncertainCeilingUsdMicros
    };
  });
}
