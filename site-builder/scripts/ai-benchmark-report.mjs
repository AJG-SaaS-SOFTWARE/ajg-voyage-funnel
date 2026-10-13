import fs from "node:fs/promises";
import { summarizeAiBenchmark } from "../lib/ai-benchmark.ts";

const filename = process.argv[2];
if (!filename) throw new Error("Usage: npm run benchmark:ai -- reviewed-attempts.json");
const raw = await fs.readFile(filename,"utf8");
if (Buffer.byteLength(raw,"utf8") > 5_000_000) throw new Error("Benchmark input exceeds 5 MB");
const attempts = JSON.parse(raw);
if (!Array.isArray(attempts) || !attempts.length || attempts.length > 10000) throw new Error("Provide 1 to 10000 benchmark attempts");
process.stdout.write(JSON.stringify({ costBasis: "estimated_USD_not_invoice", groups: summarizeAiBenchmark(attempts) },null,2)+"\n");
