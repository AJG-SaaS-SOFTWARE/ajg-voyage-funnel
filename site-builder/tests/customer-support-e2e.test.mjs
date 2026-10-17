import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../lib/customer-support-e2e.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
async function run(options={}){
 const calls=[];let ticketId='';
 const service={from(table){return {update(){return this;},select(){return this;},eq(){return this;},async single(){return {data:{id:'domain',is_primary:false},error:null};},then(resolve){return Promise.resolve(table==='support_ticket_events'?{data:options.missingAudit?[]:[{event_type:'created',actor_type:'client'},{event_type:'diagnostic',actor_type:'system',metadata:{source:'ajg-run-intake',request_id:'req_1234abcd'}},{event_type:'resolution',actor_type:'system',metadata:{status:'resolved',resolution_code:'auto_verified_managed_primary_repair'}}],error:null}:{data:[{status:'succeeded',result_code:'managed_domain_primary_repaired'}],error:null}).then(resolve);}};}};
 const fakeFetch=async(url,init)=>{
  const path=new URL(url).pathname;calls.push([path,init.method,init.headers?.Authorization]);const body=init.body?JSON.parse(init.body):null;
  if(path==='/api/support/tickets'&&init.method==='POST'){ticketId=body.requestId;return Response.json({runReceipt:options.missingReceipt?{confirmed:false}:{confirmed:true,auditRecorded:true,requestId:'req_1234abcd'},ticket:{id:ticketId,site_id:'site'},health:{diagnosis:{repairActions:['managed_domain_repair']}}});}
  if(path==='/api/support/remediate')return Response.json({result:{status:'succeeded',verified:!options.unverified,audited:true},ticketResolution:{resolved:!options.unresolved,audited:true}});
  if(path==='/site/slug')return new Response(options.badPublic?'stale':'updated-marker');
  if(path==='/api/admin/support')return Response.json({ticket:{id:ticketId,status:'closed'}});
  if(path==='/api/support/tickets')return Response.json({tickets:[{id:ticketId,status:'resolved'}]});
  throw new Error('unexpected route');
 };
 const m={exports:{}};
 new Function('module','exports','require','fetch',code)(m,m.exports,()=>({verifyManagedRepair:async()=>!options.independentFailure,verifySupportTicketInRun:async()=>!options.missingCentralReadback}),fakeFetch);
 const promise=m.exports.runCustomerSupportE2E({service,origin:'https://eltara.example/api/admin/builder-e2e',customerToken:'customer-token',adminToken:'operator-token',userId:'owner',siteId:'site',slug:'slug',publicMarker:'updated-marker'});
 return {calls,promise};
}
test('support recipe uses actual customer/operator boundaries and explicitly limits its claim',async()=>{
 const {calls,promise}=await run();const result=await promise;assert.equal(result.closure,'automatic_product_resolution');assert.equal(result.automaticProductResolutionVerified,true);assert.equal(result.centralResolutionVerified,false);assert.equal(result.centralCockpitVerified,true);assert.equal(result.automaticClosureVerified,false);
 assert.equal(calls.some(x=>x[0]==='/api/admin/support'),false);assert.equal(calls[0][2],'Bearer customer-token');
});
test('failed repair verification prevents operator closure',async()=>{
 for(const options of [{unverified:true},{independentFailure:true}]){const {calls,promise}=await run(options);await assert.rejects(promise,/repair_unconfirmed/);assert.equal(calls.some(x=>x[0]==='/api/admin/support'),false);}
});
test('missing public content prevents closure even after successful database repair',async()=>{
 const {calls,promise}=await run({badPublic:true});await assert.rejects(promise,/public_result_unconfirmed/);assert.equal(calls.some(x=>x[0]==='/api/admin/support'),false);
});
test('missing durable audit fails the recipe even if the ticket is already closed',async()=>{
 const {promise}=await run({missingAudit:true});await assert.rejects(promise,/durable_evidence_unconfirmed/);
});

test('missing central receipt prevents accepting the complete support journey',async()=>{
 const {calls,promise}=await run({missingReceipt:true});await assert.rejects(promise,/central_receipt_unconfirmed/);assert.equal(calls.some(x=>x[0]==='/api/admin/support'),false);
});

test('a POST receipt without independent cockpit readback cannot pass the journey',async()=>{
 const {calls,promise}=await run({missingCentralReadback:true});await assert.rejects(promise,/central_readback_unconfirmed/);assert.equal(calls.some(x=>x[0]==='/api/support/remediate'),false);
});

test('missing automatic resolution receipt fails without operator fallback',async()=>{const {calls,promise}=await run({unresolved:true});await assert.rejects(promise,/automatic_resolution_unconfirmed/);assert.equal(calls.some(x=>x[0]==='/api/admin/support'),false);});
