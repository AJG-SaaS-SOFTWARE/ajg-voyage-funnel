import test from "node:test";
import assert from "node:assert/strict";
import { summarizeAiBenchmark } from "../lib/ai-benchmark.ts";
const attempt = overrides => ({ candidate: "baseline",task: "assistance",estimatedUsdMicros:100,uncertainCeilingUsdMicros:0,durationMs:1000,review:{reviewer:"human",factual:true,followsRequest:true,usefulness:4,clarity:5},...overrides });

test("benchmark includes rejected attempts in the cost of an accepted result", () => {
  const [result]=summarizeAiBenchmark([attempt({}),attempt({review:{reviewer:"human",factual:false,followsRequest:true,usefulness:5,clarity:5}})]);
  assert.equal(result.accepted,1);
  assert.equal(result.estimatedUsdMicrosPerAccepted,200);
  assert.equal(result.acceptanceRate,0.5);
});
test("missing reviews or cost evidence cannot elect a cheap winning candidate", () => {
  for(const row of [attempt({review:null}),attempt({estimatedUsdMicros:null}),attempt({uncertainCeilingUsdMicros:100})]) {
    const [result]=summarizeAiBenchmark([row]); assert.equal(result.comparisonReady,false);
    if(row.estimatedUsdMicros===null || row.uncertainCeilingUsdMicros) assert.equal(result.estimatedUsdMicrosPerAccepted,null);
  }
  assert.throws(()=>summarizeAiBenchmark([attempt({review:{reviewer:"ai",factual:true,followsRequest:true,usefulness:5,clarity:5}})]),/review/);
});
test("different tasks stay separate and latency percentiles include failed attempts", () => {
  const result=summarizeAiBenchmark([attempt({durationMs:100}),attempt({durationMs:9000}),attempt({task:"creation"})]);
  assert.equal(result.length,2); assert.equal(result[0].p95DurationMs,9000);
});

 test("creation requires independent desktop and mobile visual reviews", () => {
  const missing = summarizeAiBenchmark([attempt({task:"creation"})])[0];
  assert.equal(missing.accepted,0); assert.equal(missing.fullyReviewed,0);
  assert.equal(missing.missingVisualReview,1); assert.equal(missing.acceptanceRate,null);
  assert.equal(missing.comparisonReady,false);
  for (const visualReview of [{desktop:true,mobile:false},{desktop:false,mobile:true}]) {
    const result=summarizeAiBenchmark([attempt({task:"creation",visualReview})])[0];
    assert.equal(result.accepted,0); assert.equal(result.fullyReviewed,1);
    assert.equal(result.acceptanceRate,0); assert.equal(result.estimatedUsdMicrosPerAccepted,null);
  }
  const accepted=summarizeAiBenchmark([attempt({task:"creation",visualReview:{desktop:true,mobile:true}})])[0];
  assert.equal(accepted.accepted,1); assert.equal(accepted.comparisonReady,true);
 });
 test("incomplete reviews cannot produce a final cost per accepted result", () => {
  const result=summarizeAiBenchmark([attempt({}),attempt({review:null})])[0];
  assert.equal(result.estimatedUsdMicrosPerAccepted,null);
  assert.equal(result.comparisonReady,false);
 });
 test("malformed evidence and unsafe cumulative monetary sums are rejected", () => {
  for (const row of [attempt({candidate:null}),attempt({review:undefined}),attempt({review:false}),attempt({review:[]}),attempt({visualReview:{desktop:"true",mobile:true}})]) {
    assert.throws(()=>summarizeAiBenchmark([row]),/invalid_benchmark/);
  }
  assert.throws(()=>summarizeAiBenchmark([attempt({estimatedUsdMicros:Number.MAX_SAFE_INTEGER}),attempt({})]),/measurement/);
 });

test("a matched comparison needs the same cases and frequencies for every candidate", () => {
  const rows = [attempt({candidate:"baseline",caseId:"fr-short"}), attempt({candidate:"baseline",caseId:"en-detailed"}),
    attempt({candidate:"cheaper",caseId:"en-detailed",estimatedUsdMicros:50}), attempt({candidate:"cheaper",caseId:"fr-short",estimatedUsdMicros:50})];
  assert.ok(summarizeAiBenchmark(rows).every(row => row.caseCoverageMatched && row.matchedComparisonReady));
  for (const changed of [
    [...rows.slice(0,3), attempt({candidate:"cheaper",caseId:"other-brief"})],
    [...rows, attempt({candidate:"cheaper",caseId:"fr-short"})],
    rows.map((row,i) => i === 3 ? attempt({candidate:"cheaper"}) : row)
  ]) {
    const results = summarizeAiBenchmark(changed);
    assert.ok(results.every(row => row.comparisonReady));
    assert.ok(results.every(row => !row.caseCoverageMatched && !row.matchedComparisonReady));
  }
});

test("missing peer evidence prevents a matched comparison even for the fully reviewed candidate", () => {
  for (const missing of [{review:null}, {estimatedUsdMicros:null}, {uncertainCeilingUsdMicros:10}]) {
    const results = summarizeAiBenchmark([attempt({caseId:"same"}), attempt({candidate:"cheaper",caseId:"same",...missing})]);
    assert.ok(results.every(row => row.caseCoverageMatched));
    assert.ok(results.every(row => !row.matchedComparisonReady));
  }
  assert.equal(summarizeAiBenchmark([attempt({caseId:"same"})])[0].matchedComparisonReady,false);
});

test("task cohorts remain separate and malformed case IDs are rejected", () => {
  const rows = [attempt({caseId:"same"}), attempt({candidate:"cheaper",caseId:"same"}), attempt({task:"diagnostic",caseId:"same"})];
  const result = summarizeAiBenchmark(rows);
  assert.equal(result[0].matchedComparisonReady,true);
  assert.equal(result[2].matchedComparisonReady,false);
  for (const caseId of [null,"", " ",1,[]]) assert.throws(() => summarizeAiBenchmark([attempt({caseId})]),/invalid_benchmark_case/);
});
