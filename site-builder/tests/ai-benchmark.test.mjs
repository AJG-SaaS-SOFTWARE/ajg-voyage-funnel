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
