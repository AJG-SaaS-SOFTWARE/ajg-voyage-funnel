import fs from "node:fs/promises";
import path from "node:path";
import { prepareAiBenchmarkReview, mergeAiBenchmarkReviews } from "../lib/ai-benchmark-review.ts";
import { summarizeAiBenchmark } from "../lib/ai-benchmark.ts";

async function readJson(filename) {
  const raw = await fs.readFile(filename, "utf8");
  if (Buffer.byteLength(raw, "utf8") > 5_000_000) throw new Error("Benchmark input exceeds 5 MB");
  return JSON.parse(raw);
}

const [mode, first, second, third] = process.argv.slice(2);
if (mode === "prepare" && first && second) {
  const corpus = await readJson(third || new URL("../tests/fixtures/ai-benchmark-corpus.json", import.meta.url));
  const prepared = prepareAiBenchmarkReview(corpus, await readJson(first));
  const directory = path.resolve(second);
  await fs.mkdir(directory, { mode: 0o700 }); // Refuse an existing packet directory.
  try {
    for (const [name, value] of [["review-packet.json", prepared.packet], ["review-form.json", prepared.form], ["operator-manifest.json", prepared.manifest]]) {
      await fs.writeFile(path.join(directory, name), JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    }
  } catch (error) {
    await fs.rm(directory, { recursive: true, force: true });
    throw error;
  }
  process.stdout.write("Review packet prepared. Share review-packet.json and review-form.json only; keep operator-manifest.json private.\n");
} else if (mode === "merge" && first && second && third) {
  const attempts = mergeAiBenchmarkReviews(await readJson(first), await readJson(second));
  await fs.writeFile(third, JSON.stringify(attempts, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  process.stdout.write(JSON.stringify({ costBasis: "estimated_USD_not_invoice", groups: summarizeAiBenchmark(attempts) }, null, 2) + "\n");
} else {
  throw new Error("Usage: npm run benchmark:review -- prepare samples.json new-directory [corpus.json] | merge operator-manifest.json reviews.json new-output.json");
}
