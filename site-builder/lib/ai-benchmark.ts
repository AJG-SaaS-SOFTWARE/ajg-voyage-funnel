export type AiBenchmarkAttempt = {
  candidate: string;
  caseId?: string;
  task: "assistance" | "diagnostic" | "section" | "creation";
  estimatedUsdMicros: number | null;
  uncertainCeilingUsdMicros: number;
  durationMs: number;
  visualReview?: null | { desktop: boolean; mobile: boolean };
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
    if (!row || typeof row.candidate !== "string" || !row.candidate.trim() || !["assistance","diagnostic","section","creation"].includes(row.task)) throw new Error("invalid_benchmark_task");
    if (row.caseId !== undefined && (typeof row.caseId !== "string" || !row.caseId.trim())) throw new Error("invalid_benchmark_case");
    integer(row.durationMs); integer(row.uncertainCeilingUsdMicros);
    if (row.estimatedUsdMicros !== null) integer(row.estimatedUsdMicros);
    if (row.review !== null && (!row.review || typeof row.review !== "object" || Array.isArray(row.review))) throw new Error("invalid_benchmark_review");
    if (row.visualReview != null && (typeof row.visualReview.desktop !== "boolean" || typeof row.visualReview.mobile !== "boolean")) throw new Error("invalid_benchmark_visual_review");
    if (row.review) {
      if (row.review.reviewer !== "human" || typeof row.review.factual !== "boolean" || typeof row.review.followsRequest !== "boolean") throw new Error("invalid_benchmark_review");
      if (integer(row.review.usefulness,1)>5 || integer(row.review.clarity,1)>5) throw new Error("invalid_benchmark_review");
    }
    const key = JSON.stringify([row.candidate,row.task]);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key,[row]);
  }
  const summaries = [...groups.values()].map(rows => {
    const reviewed = rows.filter(row => row.review !== null);
    const fullyReviewed = reviewed.filter(row => row.task !== "creation" || row.visualReview != null);
    const accepted = fullyReviewed.filter(row => row.review!.factual && row.review!.followsRequest && row.review!.usefulness>=4 && row.review!.clarity>=4 &&
      (row.task !== "creation" || (row.visualReview!.desktop && row.visualReview!.mobile)));
    const unknownCost = rows.filter(row => row.estimatedUsdMicros === null).length;
    const uncertainCeilingUsdMicros = rows.reduce((sum,row) => sum+row.uncertainCeilingUsdMicros,0);
    const knownEstimatedUsdMicros = rows.reduce((sum,row) => sum+(row.estimatedUsdMicros??0),0);
    integer(knownEstimatedUsdMicros); integer(uncertainCeilingUsdMicros);
    return {
      candidate: rows[0].candidate, task: rows[0].task, attempts: rows.length,
      reviewed: reviewed.length, fullyReviewed: fullyReviewed.length, missingVisualReview: rows.filter(row => row.task === "creation" && row.visualReview == null).length, accepted: accepted.length,
      acceptanceRate: fullyReviewed.length ? accepted.length/fullyReviewed.length : null,
      knownEstimatedUsdMicros, uncertainCeilingUsdMicros, unknownCost,
      estimatedUsdMicrosPerAccepted: accepted.length && fullyReviewed.length===rows.length && !unknownCost && !uncertainCeilingUsdMicros ? knownEstimatedUsdMicros/accepted.length : null,
      medianDurationMs: percentile(rows.map(row=>row.durationMs),0.5),
      p95DurationMs: percentile(rows.map(row=>row.durationMs),0.95),
      comparisonReady: fullyReviewed.length===rows.length && !unknownCost && !uncertainCeilingUsdMicros
    };
  });
  return summaries.map(summary => {
    const peers = summaries.filter(peer => peer.task === summary.task);
    const coverage = peers.map(peer => {
      const rows = groups.get(JSON.stringify([peer.candidate, peer.task]))!;
      if (rows.some(row => row.caseId === undefined)) return null;
      const counts = new Map<string, number>();
      for (const row of rows) {
        const id = row.caseId!.trim();
        counts.set(id, (counts.get(id) || 0) + 1);
      }
      return JSON.stringify([...counts.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
    });
    // Equal case frequencies prevent an easier brief mix from looking cheaper.
    const caseCoverageMatched = peers.length > 1 && coverage[0] !== null &&
      coverage.every(signature => signature === coverage[0]);
    return {
      ...summary,
      caseCoverageMatched,
      matchedComparisonReady: caseCoverageMatched && peers.every(peer => peer.comparisonReady)
    };
  });
}
