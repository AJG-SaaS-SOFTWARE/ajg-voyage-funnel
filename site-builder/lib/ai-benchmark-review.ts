import { createHash, randomInt, randomUUID } from "node:crypto";
import { summarizeAiBenchmark, type AiBenchmarkAttempt } from "./ai-benchmark.ts";

type Task = AiBenchmarkAttempt["task"];
export type BenchmarkCorpus = {
  version: string;
  cases: Array<{ id: string; task: Task; input: unknown; reviewFocus: string[] }>;
};
export type BenchmarkReviewSample = Omit<AiBenchmarkAttempt, "review" | "visualReview"> & {
  caseId: string; input: unknown; output: unknown;
};
type Manifest = {
  version: 1; corpusVersion: string;
  samples: Array<{ id: string; inputFingerprint: string; attempt: AiBenchmarkAttempt }>;
};
type Submission = { id: string; review: AiBenchmarkAttempt["review"]; visualReview?: AiBenchmarkAttempt["visualReview"] };

function canonical(value: unknown, depth = 0): string {
  if (depth > 30) throw new Error("benchmark_json_too_deep");
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(item => canonical(item, depth + 1)).join(",") + "]";
  if (value && typeof value === "object" && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    const object = value as Record<string, unknown>;
    return "{" + Object.keys(object).sort().map(key => JSON.stringify(key) + ":" + canonical(object[key], depth + 1)).join(",") + "}";
  }
  throw new Error("invalid_benchmark_json");
}

function fingerprint(task: Task, input: unknown) {
  return createHash("sha256").update(canonical({ task, input })).digest("hex");
}

function customerOutput(output: unknown) {
  canonical(output); // Reject undefined, non-JSON values and cyclic/deep input.
  if (!output || typeof output !== "object" || Array.isArray(output)) return output;
  const hidden = new Set(["premiumAudit", "intelligence", "candidate", "model", "provider", "usage",
    "estimatedUsdMicros", "uncertainCeilingUsdMicros", "durationMs", "providerCalls"]);
  return Object.fromEntries(Object.entries(output).filter(([key]) => !hidden.has(key)));
}

export function prepareAiBenchmarkReview(corpus: BenchmarkCorpus, samples: BenchmarkReviewSample[]) {
  if (!corpus || typeof corpus.version !== "string" || !corpus.version.trim() ||
      !Array.isArray(corpus.cases) || !corpus.cases.length || corpus.cases.length > 1000 ||
      !Array.isArray(samples) || !samples.length || samples.length > 1000) throw new Error("invalid_benchmark_corpus");
  const cases = new Map<string, BenchmarkCorpus["cases"][number]>();
  for (const item of corpus.cases) {
    if (!item || typeof item.id !== "string" || !item.id.trim() ||
        !["assistance", "diagnostic", "section", "creation"].includes(item.task) ||
        !Array.isArray(item.reviewFocus) || item.reviewFocus.some(text => typeof text !== "string")) throw new Error("invalid_benchmark_case");
    const key = JSON.stringify([item.task, item.id.trim()]);
    if (cases.has(key)) throw new Error("duplicate_benchmark_case");
    fingerprint(item.task, item.input);
    cases.set(key, item);
  }
  const manifest: Manifest = { version: 1, corpusVersion: corpus.version, samples: [] };
  const packet = { version: 1, corpusVersion: corpus.version,
    instructions: ["Évaluez chaque résultat selon les faits et la demande fournis, sans deviner le modèle.",
      "Un score produit par l’IA ne remplace pas votre évaluation. Un résultat absent doit aussi être évalué.",
      "Laissez review à null pour un résultat non évalué. Sinon renseignez reviewer=human, factual et followsRequest (booléens), usefulness et clarity (entiers de 1 à 5).",
      "factual exige des affirmations étayées par la source ; followsRequest exige le respect de la demande et de son périmètre. Pour utilité/clarté : 1=inexploitable, 3=corrections importantes, 5=prêt à utiliser.",
      "Pour la création complète, desktop/mobile nécessitent une revue humaine du rendu ; laissez null si elle n’a pas été faite."],
    samples: [] as Array<{ id: string; task: Task; caseId: string; input: unknown; output: unknown; reviewFocus: string[]; visualReviewRequired: boolean }> };
  for (const sample of samples) {
    if (!sample || typeof sample.caseId !== "string" || !sample.caseId.trim()) throw new Error("invalid_benchmark_case");
    const item = cases.get(JSON.stringify([sample.task, sample.caseId.trim()]));
    if (!item) throw new Error("unknown_benchmark_case");
    const inputFingerprint = fingerprint(sample.task, sample.input);
    if (inputFingerprint !== fingerprint(item.task, item.input)) throw new Error("benchmark_input_mismatch");
    const id = randomUUID();
    const attempt: AiBenchmarkAttempt = { candidate: sample.candidate, task: sample.task, caseId: item.id.trim(),
      estimatedUsdMicros: sample.estimatedUsdMicros, uncertainCeilingUsdMicros: sample.uncertainCeilingUsdMicros,
      durationMs: sample.durationMs, review: null };
    manifest.samples.push({ id, inputFingerprint, attempt });
    packet.samples.push({ id, task: sample.task, caseId: item.id.trim(), input: JSON.parse(canonical(sample.input)),
      output: JSON.parse(canonical(customerOutput(sample.output))), reviewFocus: [...item.reviewFocus], visualReviewRequired: sample.task === "creation" });
  }
  const groups = summarizeAiBenchmark(manifest.samples.map(sample => sample.attempt));
  if (groups.some(group => !group.caseCoverageMatched)) throw new Error("unmatched_benchmark_cohort");
  for (const group of groups) {
    const expected = [...cases.values()].filter(item => item.task === group.task);
    const included = new Set(manifest.samples.filter(sample => sample.attempt.task === group.task && sample.attempt.candidate === group.candidate).map(sample => sample.attempt.caseId));
    if (expected.some(item => !included.has(item.id.trim()))) throw new Error("incomplete_benchmark_corpus");
  }
  for (let index = packet.samples.length - 1; index > 0; index--) {
    const other = randomInt(index + 1);
    [packet.samples[index], packet.samples[other]] = [packet.samples[other], packet.samples[index]];
  }
  const form = { version: 1, reviews: packet.samples.map(sample => ({ id: sample.id, review: null,
    ...(sample.visualReviewRequired ? { visualReview: null } : {}) })) };
  return { packet, manifest, form };
}

export function mergeAiBenchmarkReviews(manifest: Manifest, submission: { version: 1; reviews: Submission[] }) {
  if (!manifest || manifest.version !== 1 || typeof manifest.corpusVersion !== "string" || !manifest.corpusVersion.trim() ||
      !Array.isArray(manifest.samples) || !manifest.samples.length || manifest.samples.length > 1000 ||
      !submission || submission.version !== 1 || !Array.isArray(submission.reviews)) throw new Error("invalid_benchmark_review_packet");
  const ids = new Set<string>();
  const inputs = new Map<string, string>();
  for (const sample of manifest.samples) {
    if (!sample || typeof sample.id !== "string" || !sample.id || ids.has(sample.id) ||
        !/^[a-f0-9]{64}$/.test(sample.inputFingerprint) || sample.attempt?.review !== null || sample.attempt?.visualReview != null ||
        typeof sample.attempt.caseId !== "string" || !sample.attempt.caseId.trim()) throw new Error("invalid_benchmark_manifest");
    const key = JSON.stringify([sample.attempt.task, sample.attempt.caseId.trim()]);
    if (inputs.has(key) && inputs.get(key) !== sample.inputFingerprint) throw new Error("benchmark_input_mismatch");
    inputs.set(key, sample.inputFingerprint);
    ids.add(sample.id);
  }
  const reviews = new Map<string, Submission>();
  for (const review of submission.reviews) {
    if (!review || !ids.has(review.id) || reviews.has(review.id)) throw new Error("invalid_benchmark_review_id");
    reviews.set(review.id, review);
  }
  const attempts = manifest.samples.map(sample => ({
    candidate: sample.attempt.candidate, task: sample.attempt.task, caseId: sample.attempt.caseId,
    estimatedUsdMicros: sample.attempt.estimatedUsdMicros, uncertainCeilingUsdMicros: sample.attempt.uncertainCeilingUsdMicros,
    durationMs: sample.attempt.durationMs,
    inputFingerprint: sample.inputFingerprint,
    review: reviews.has(sample.id) ? reviews.get(sample.id)!.review : null,
    visualReview: reviews.get(sample.id)?.visualReview ?? null }));
  summarizeAiBenchmark(attempts); // Retain strict human/visual/cost validation.
  return attempts;
}
