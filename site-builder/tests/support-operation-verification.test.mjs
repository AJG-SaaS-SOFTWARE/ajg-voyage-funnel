import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

function agent({runtimeStatus="healthy",checked=true,truncated=false,remediationOk=true}={}) {
  const events=[],journal=[];
  const service={from(name){
    assert.equal(name,"support_operations_runs");
    const query={insert(){return query},select(){return query},single:async()=>({data:{id:1},error:null}),
      update(value){journal.push(value);return query},eq:async()=>({error:null})};
    return query;
  }};
  const dependencies={
    "@supabase/supabase-js":{},
    "./support-reconcile":{runSupportReconciliationSafely:async()=>{
      events.push("reconcile");assert.ok(events.includes("repair_complete"));
      return {ok:true,scanned:1,resolved:1,escalated:0,waiting:0,failed:0};}},
    "./support-remediation-sweep":{runSupportRemediationSweepSafely:async()=>{
      events.push("repair_complete");return {ok:remediationOk,scanned:1,eligible:1,attempted:1,succeeded:remediationOk?1:0,noChange:0,failed:remediationOk?0:1};}},
    "./vercel-runtime-health":{getRecentRuntimeHealth:async()=>({status:runtimeStatus,checked,truncated, deploymentId:null,errorCount:0,fatalCount:0,http5xxCount:0})},
    "./run-intake-reporting":{reportRuntimeIncidentToRun:async()=>({ok:true})},
    "./platform-self-healing":{runPlatformSelfHealing:async()=>({status:"healthy",actions:[],repaired:0,failed:0,backupStatusAfter:"healthy"})}
  };
  const code=ts.transpileModule(fs.readFileSync(new URL("../lib/support-operations-agent.ts",import.meta.url),"utf8"),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};
  new Function("require","module","exports",code)(name=>{assert.ok(name in dependencies,name);return dependencies[name]},module,module.exports);
  return {run:()=>module.exports.runSupportOperationsAgent(service,new Date("2026-10-14T08:00:00Z")),events,journal};
}

test("operations verify repairs before reconciling and journal the verified result",async()=>{
  const app=agent();const result=await app.run();
  assert.deepEqual(app.events,["repair_complete","reconcile"]);
  assert.equal(result.runStatus,"healthy");assert.equal(app.journal[0].remediation_succeeded,1);
});
test("unavailable or truncated runtime evidence is attention, never healthy",async()=>{
  for(const config of [{checked:false},{runtimeStatus:"unknown"},{truncated:true}]){
    const result=await agent(config).run();assert.equal(result.runStatus,"attention");
  }
});
test("a failed repair is visible as a failed operation rather than a healthy run",async()=>{
  const result=await agent({remediationOk:false}).run();assert.equal(result.runStatus,"failed");assert.equal(result.ok,false);
});
