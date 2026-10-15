import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import {createClient} from "@supabase/supabase-js";
import {supportScanWindow} from "../lib/support-scan-window.ts";
import {supportCustomerAction,supportReconcileDecision} from "../lib/support-reconcile-policy.ts";
const at=hour=>new Date(hour*3_600_000);

test("successive hourly windows cover the entire stable population with no unbounded batch",()=>{
  for(const count of [0,1,49,50,51,101,151,1001]){
    const visited=new Set();const windows=Math.max(1,Math.ceil(count/50));
    for(let hour=0;hour<windows;hour++){
      const page=supportScanWindow(count,at(hour));
      assert.ok(page.end-page.offset+1<=50);
      for(let i=page.offset;i<=page.end;i++)visited.add(i);
    }
    assert.equal(visited.size,count);
  }
});
test("unknown counts and invalid clocks stop scanning instead of claiming an empty healthy queue",()=>{
  for(const count of [null,NaN,-1,1.5,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>supportScanWindow(count,at(0)));
  assert.throws(()=>supportScanWindow(1,new Date("invalid")));
});

function load(name,dependencies){
  const health = dependencies["./support-health-server"];
  if (health?.diagnoseSupportHealth) health.createSupportHealthDiagnoser = service => (...args) => health.diagnoseSupportHealth(service, ...args);
  const code=ts.transpileModule(fs.readFileSync(new URL(`../lib/${name}.ts`,import.meta.url),"utf8"),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};
  new Function("require","module","exports",code)(id=>{
    if(id==="@supabase/supabase-js")return {};
    if(id==="./support-scan-window")return {supportScanWindow};
    assert.ok(id in dependencies,id);return dependencies[id];
  },module,module.exports);return module.exports;
}
function db({count=151,sites=[],tickets=[],healthyDomains=true,repairRuns=[]}={}){
  const requests=[];
  const service=createClient("https://synthetic.example.test","synthetic-service",{
    auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(url,init)=>{
      const u=new URL(url);requests.push({url:u,method:init.method,headers:new Headers(init.headers)});
      if(init.method==="HEAD")return new Response(null,{status:200,headers:{"content-range":`*/${count}`}});
      if(init.method==="PATCH")return Response.json({id:u.searchParams.get("id").slice(3)});
      const offset=Number(u.searchParams.get("offset")||0),limit=Number(u.searchParams.get("limit")||50);
      if(u.pathname.endsWith("/sites"))return Response.json(sites.slice(offset,offset+limit));
      if(u.pathname.endsWith("/support_tickets"))return Response.json(tickets.slice(offset,offset+limit));
      if(u.pathname.endsWith("/domains")){
        if(!healthyDomains)return Response.json([]);
        const selected=new Set((u.searchParams.get("site_id")||"").slice(4,-1).split(","));
        return Response.json(sites.filter(s=>selected.has(s.id)).map(s=>({site_id:s.id,kind:"managed_subdomain",verification_status:"verified",is_primary:true})));
      }
      if(u.pathname.endsWith("/support_remediation_runs")){
        const selected=new Set((u.searchParams.get("site_id")||"").slice(4,-1).split(","));
        const since=Date.parse((u.searchParams.get("created_at")||"").slice(4));
        return Response.json(repairRuns.filter(r=>selected.has(r.site_id)&&Date.parse(r.created_at)>=since));
      }
      throw new Error(`Unexpected request ${url}`);
    }}});
  return {service,requests};
}
test("real SDK site scans progress past the first 50 rows while avoiding repairs on healthy domains",async()=>{
  const sites=Array.from({length:151},(_,i)=>({id:`site-${i}`,owner_id:"owner"}));
  const app=db({sites});let repairs=0;
  const {runSupportRemediationSweepSafely}=load("support-remediation-sweep",{
    "./support-remediation":{runSupportRepair:async()=>{repairs++;throw new Error("Healthy domain must not be repaired")}}});
  for(let hour=0;hour<4;hour++){
    const result=await runSupportRemediationSweepSafely(at(hour),app.service);
    assert.equal(result.ok,true);assert.equal(result.scanned,hour===3?1:50);
  }
  const reads=app.requests.filter(r=>r.method==="GET"&&r.url.pathname.endsWith("/sites"));
  assert.deepEqual(reads.map(r=>Number(r.url.searchParams.get("offset")||0)),[0,50,100,150]);
  assert.equal(repairs,0);
});
test("real SDK ticket reconciliation carries prior evidence, scopes updates and reuses each site's diagnostic",async()=>{
  const tickets=Array.from({length:151},(_,i)=>({id:`ticket-${i}`,user_id:"owner",site_id:"site",category:"domain",
    created_at:at(0).toISOString(),diagnosis:{checks:[{key:"domain",status:"action"}]}}));
  const app=db({tickets});let diagnoses=0;
  const {runSupportReconciliationSafely}=load("support-reconcile",{
    "./support-reconcile-policy":{supportCustomerAction,supportReconcileDecision},
    "./support-health-server":{diagnoseSupportHealth:async()=>{diagnoses++;return {diagnosis:{overall:"healthy",clientAction:null,
      checks:["backend","public_render","domain"].map(key=>({key,status:"healthy"}))}}}},
    "./support-events":{recordSupportEvent:async()=>true}});
  for(let hour=0;hour<4;hour++){
    const result=await runSupportReconciliationSafely(at(hour),app.service);
    assert.equal(result.ok,true);assert.equal(result.resolved,hour===3?1:50);
  }
  assert.equal(diagnoses,4,"one diagnostic per same-site batch instead of one per ticket");
  for(const write of app.requests.filter(r=>r.method==="PATCH")){
    assert.equal(write.url.searchParams.get("user_id"),"eq.owner");
    assert.equal(write.url.searchParams.get("status"),"eq.waiting_customer");
  }
});

test("a ticket transition with an unconfirmed audit event is not counted as an autonomous success",async()=>{
  const app=db({count:1,tickets:[{id:"ticket-1",user_id:"owner",site_id:"site",category:"domain",
    created_at:at(0).toISOString(),diagnosis:{checks:[{key:"domain",status:"action"}]}}]});
  const {runSupportReconciliationSafely}=load("support-reconcile",{
    "./support-reconcile-policy":{supportCustomerAction,supportReconcileDecision},
    "./support-health-server":{diagnoseSupportHealth:async()=>({diagnosis:{overall:"healthy",checks:
      ["backend","public_render","domain"].map(key=>({key,status:"healthy"}))}})},
    "./support-events":{recordSupportEvent:async()=>false}});
  const result=await runSupportReconciliationSafely(at(0),app.service);
  assert.equal(result.ok,false);assert.equal(result.failed,1);assert.equal(result.resolved,0);
  assert.equal(app.requests.filter(r=>r.method==="PATCH").length,1,"an uncertain audit must not replay the transition");
});

test("persistent failed repairs cannot monopolize slots ahead of later customers",async()=>{
  const sites=Array.from({length:151},(_,i)=>({id:`site-${i}`,owner_id:"owner"}));
  const repairRuns=[],visited=new Set();let currentHour=0;
  const app=db({sites,healthyDomains:false,repairRuns});
  const {runSupportRemediationSweepSafely}=load("support-remediation-sweep",{
    "./support-remediation":{runSupportRepair:async(_service,input)=>{
      visited.add(input.siteId);repairRuns.push({site_id:input.siteId,created_at:at(currentHour).toISOString()});
      return {status:"failed",verified:false,audited:true};
    }}});
  for(currentHour=0;currentHour<20;currentHour++){
    const result=await runSupportRemediationSweepSafely(at(currentHour),app.service);
    assert.ok(result.attempted<=10);assert.ok(result.scanned<=50);
    assert.equal(result.failed,result.attempted);
  }
  assert.equal(visited.size,151,"five complete scan cycles must give every stable candidate a chance even if all attempts fail");
});
