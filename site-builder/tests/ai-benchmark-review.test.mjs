import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { prepareAiBenchmarkReview, mergeAiBenchmarkReviews } from "../lib/ai-benchmark-review.ts";
import { summarizeAiBenchmark } from "../lib/ai-benchmark.ts";

const corpus = { version: "test-v1", cases: [{ id: "source-fr", task: "creation",
  input: { language: "French", brief: "Un atelier à Nantes", facts: ["Sur rendez-vous"] }, reviewFocus: ["Préserver les faits"] }] };
function samples() {
  return ["private-baseline-candidate", "private-alternative-candidate"].map((candidate,index) => ({
    candidate, caseId: "source-fr", task: "creation", input: structuredClone(corpus.cases[0].input),
    output: { heroTitle: "Un atelier à Nantes", premiumAudit: { finalScore: 99 }, intelligence: { readiness: "strong" }, model: candidate },
    estimatedUsdMicros: 100 + index * 20, uncertainCeilingUsdMicros: 0, durationMs: 500
  }));
}
const human = { reviewer: "human", factual: true, followsRequest: true, usefulness: 4, clarity: 5 };

test("review packets hide candidate/cost/self-score metadata and keep a separate mapping", () => {
  const input=samples(); const prepared=prepareAiBenchmarkReview(corpus,input);
  assert.equal(prepared.packet.samples.length,2);
  assert.equal(new Set(prepared.packet.samples.map(row=>row.id)).size,2);
  const publicData=JSON.stringify([prepared.packet,prepared.form]);
  assert.doesNotMatch(publicData,/private-baseline|private-alternative|premiumAudit|finalScore|estimatedUsdMicros|durationMs|readiness/);
  assert.ok(prepared.manifest.samples.every(row=>row.attempt.review===null&&/^[a-f0-9]{64}$/.test(row.inputFingerprint)));
  for(const row of prepared.packet.samples) {
    assert.deepEqual(row.output,{heroTitle:"Un atelier à Nantes"});
    assert.equal(row.visualReviewRequired,true);
  }
  input[0].input.brief="Changed afterwards";
  assert.ok(prepared.packet.samples.every(row=>row.input.brief==="Un atelier à Nantes"));
});

test("case IDs cannot hide a different brief, array order, or missing corpus cases", () => {
  const changed=samples(); changed[1].input.brief="Un restaurant à Lyon";
  assert.throws(()=>prepareAiBenchmarkReview(corpus,changed),/input_mismatch/);
  const reordered=samples(); reordered[1].input={facts:["Sur rendez-vous"],brief:"Un atelier à Nantes",language:"French"};
  assert.doesNotThrow(()=>prepareAiBenchmarkReview(corpus,reordered));
  const additional=structuredClone(corpus); additional.cases.push({...additional.cases[0],id:"second-case"});
  assert.throws(()=>prepareAiBenchmarkReview(additional,samples()),/incomplete_benchmark_corpus/);
  assert.throws(()=>prepareAiBenchmarkReview(corpus,samples().slice(0,1)),/unmatched_benchmark_cohort/);
  assert.throws(()=>prepareAiBenchmarkReview(corpus,[...samples(),samples()[0]]),/unmatched_benchmark_cohort/);
  const arrays=structuredClone(corpus); arrays.cases[0].input.facts=["A","B"];
  const rows=samples(); rows.forEach(row=>row.input=structuredClone(arrays.cases[0].input)); rows[1].input.facts.reverse();
  assert.throws(()=>prepareAiBenchmarkReview(arrays,rows),/input_mismatch/);
});

test("human reviews merge by opaque ID and retain costs without borrowing AI scores", () => {
  const {manifest}=prepareAiBenchmarkReview(corpus,samples());
  const reviews={version:1,reviews:manifest.samples.slice().reverse().map(row=>({id:row.id,review:human,visualReview:{desktop:true,mobile:true}}))};
  const merged=mergeAiBenchmarkReviews(manifest,reviews);
  assert.deepEqual(merged.map(row=>row.estimatedUsdMicros),[100,120]);
  assert.ok(summarizeAiBenchmark(merged).every(group=>group.matchedComparisonReady&&group.accepted===1));
  const incomplete=mergeAiBenchmarkReviews(manifest,{version:1,reviews:[{id:manifest.samples[0].id,review:human}]});
  assert.ok(summarizeAiBenchmark(incomplete).every(group=>!group.matchedComparisonReady));
  assert.equal(incomplete[1].review,null);
  assert.equal(summarizeAiBenchmark(incomplete)[0].accepted,0,"creation still needs actual desktop/mobile reviews");
});

test("unknown/duplicate review IDs, forged reviewer types and inconsistent manifests are rejected", () => {
  const {manifest}=prepareAiBenchmarkReview(corpus,samples()); const id=manifest.samples[0].id;
  for(const reviews of [[{id:"unknown",review:human}],[{id,review:human},{id,review:human}],
    [{id,review:{...human,reviewer:"ai"}}]]) {
    assert.throws(()=>mergeAiBenchmarkReviews(manifest,{version:1,reviews}),/benchmark/);
  }
  const duplicate=structuredClone(manifest); duplicate.samples[1].id=id;
  assert.throws(()=>mergeAiBenchmarkReviews(duplicate,{version:1,reviews:[]}),/manifest/);
  const mismatch=structuredClone(manifest); mismatch.samples[1].inputFingerprint="a".repeat(64);
  assert.throws(()=>mergeAiBenchmarkReviews(mismatch,{version:1,reviews:[]}),/input_mismatch/);
});

test("non-JSON/deep inputs and oversized repeated review criteria stop before packet creation", () => {
  const cyclic=samples(); cyclic[0].input.self=cyclic[0].input;
  assert.throws(()=>prepareAiBenchmarkReview(corpus,cyclic),/benchmark_json/);
  for(const focus of [[],Array(11).fill("criterion"),["x".repeat(501)]]) {
    const altered=structuredClone(corpus); altered.cases[0].reviewFocus=focus;
    assert.throws(()=>prepareAiBenchmarkReview(altered,samples()),/invalid_benchmark_case/);
  }
});

test("the versioned synthetic corpus covers both languages across all four task scopes", () => {
  const actual=JSON.parse(fs.readFileSync(new URL("fixtures/ai-benchmark-corpus.json",import.meta.url),"utf8"));
  for(const task of ["assistance","diagnostic","section","creation"]) {
    const cases=actual.cases.filter(row=>row.task===task);
    assert.deepEqual(new Set(cases.map(row=>row.input.language)),new Set(["French","English"]));
  }
  const all=actual.cases.flatMap(row=>["baseline","alternative"].map(candidate=>({candidate,caseId:row.id,task:row.task,
    input:row.input,output:null,estimatedUsdMicros:null,uncertainCeilingUsdMicros:0,durationMs:0})));
  const prepared=prepareAiBenchmarkReview(actual,all);
  assert.equal(prepared.packet.samples.length,16);
  assert.ok(prepared.form.reviews.every(row=>row.review===null));
});

test("offline CLI prepares separate files, merges reviews, and never overwrites prior evidence", () => {
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),"eltara-review-"));
  const script=fileURLToPath(new URL("../scripts/ai-benchmark-review.mjs",import.meta.url));
  const run=args=>execFileSync(process.execPath,[script,...args],{encoding:"utf8",stdio:["ignore","pipe","pipe"]});
  try {
    const corpusFile=path.join(temp,"corpus.json"),samplesFile=path.join(temp,"samples.json"),directory=path.join(temp,"packet");
    fs.writeFileSync(corpusFile,JSON.stringify(corpus)); fs.writeFileSync(samplesFile,JSON.stringify(samples()));
    run(["prepare",samplesFile,directory,corpusFile]);
    const manifestFile=path.join(directory,"operator-manifest.json"),formFile=path.join(directory,"review-form.json");
    const before=fs.readFileSync(manifestFile,"utf8");
    assert.throws(()=>run(["prepare",samplesFile,directory,corpusFile]));
    assert.equal(fs.readFileSync(manifestFile,"utf8"),before);
    const form=JSON.parse(fs.readFileSync(formFile,"utf8"));
    form.reviews.forEach(row=>{row.review=human;row.visualReview={desktop:true,mobile:true};});
    fs.writeFileSync(formFile,JSON.stringify(form));
    const output=path.join(temp,"reviewed.json");
    const report=JSON.parse(run(["merge",manifestFile,formFile,output]));
    assert.ok(report.groups.every(row=>row.matchedComparisonReady));
    assert.throws(()=>run(["merge",manifestFile,formFile,output]));
    assert.equal(JSON.parse(fs.readFileSync(output,"utf8")).length,2);
  } finally { fs.rmSync(temp,{recursive:true,force:true}); }
});
