import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source=fs.readFileSync(new URL("../lib/support-remediation.ts",import.meta.url),"utf8");
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};
new Function("require","module","exports",code)(name=>{
  if(name==="./published-domain")return {managedHostname:slug=>`${slug}.example.test`};
  if(name==="./vercel-domain-sync")return {VercelDomainSyncError:class extends Error{}};
  throw new Error(name);
},module,module.exports);
const {verifyManagedRepair,runSupportRepair}=module.exports;
const input={userId:"owner",siteId:"site"};
const goodDomain={hostname:"studio.example.test",kind:"managed_subdomain",verification_status:"verified",is_primary:true};

function service({domains=[goodDomain],site={slug:"studio",status:"published",privacy_state:"active"},readError=false,auditError=false}={}){
  const observed=[];
  return {observed,from(table){
    const query={select(){return query},eq(key,value){observed.push([table,key,value]);return query},
      maybeSingle:async()=>({data:site,error:readError?{}:null}),
      then(resolve,reject){return Promise.resolve({data:domains,error:readError?{}:null}).then(resolve,reject)},
      insert:async()=>({error:auditError?{code:"SYNTHETIC"}:null})};
    return query;
  }};
}
test("repair verification rereads ownership and the final unique primary domain",async()=>{
  const db=service();assert.equal(await verifyManagedRepair(db,input),true);
  assert.ok(db.observed.some(([table,key,value])=>table==="sites"&&key==="owner_id"&&value==="owner"));
  assert.ok(db.observed.some(([table,key,value])=>table==="domains"&&key==="site_id"&&value==="site"));
});
test("unconfirmed updates, privacy changes, competing domains and unavailable evidence cannot prove success",async()=>{
  const cases=[{domains:[]},{domains:[{...goodDomain,is_primary:false}]},
    {domains:[{...goodDomain,verification_status:"pending"}]},
    {domains:[{...goodDomain,hostname:"foreign.example.test"}]},
    {domains:[goodDomain,goodDomain]},
    {domains:[goodDomain,{kind:"custom_domain",is_primary:false}]},
    {site:null},{readError:true},{site:{slug:"studio",status:"draft",privacy_state:"active"}},
    {site:{slug:"studio",status:"published",privacy_state:"erasure_requested"}}];
  for(const config of cases)assert.equal(await verifyManagedRepair(service(config),input),false);
});
test("an unrecorded repair result fails visibly instead of reporting an audited success",async()=>{
  const db=service({auditError:true});
  const result=await runSupportRepair(db,{...input,action:"unsupported",trigger:"system"});
  assert.equal(result.status,"failed");assert.equal(result.code,"repair_audit_unavailable");assert.equal(result.audited,false);
});
