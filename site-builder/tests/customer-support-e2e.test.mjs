import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../lib/customer-support-e2e.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
async function run(options={}){
 const calls=[];let ticketId='';const retention=[],scopes=[];
 const service={from(table){return {update(){return this;},select(){return this;},eq(){return this;},async single(){return {data:{id:'domain',is_primary:false},error:null};},then(resolve){return Promise.resolve(table==='support_ticket_events'?{data:options.missingAudit?[]:[{event_type:'created',actor_type:'client'},{event_type:'diagnostic',actor_type:'system',metadata:{source:'ajg-run-intake',request_id:'req_1234abcd'}},{event_type:'resolution',actor_type:'system',metadata:{status:'resolved',resolution_code:'auto_verified_managed_primary_repair'}}],error:null}:{data:[{status:'succeeded',result_code:'managed_domain_primary_repaired',trigger_source:options.wrongTrigger?'client':'system'}],error:null}).then(resolve);}};}};
 const fakeFetch=async(url,init)=>{
  const path=new URL(url).pathname;calls.push([path,init.method,init.headers?.Authorization]);const body=init.body?JSON.parse(init.body):null;
  if(path==='/api/support/tickets'&&init.method==='POST'){ticketId=body.requestId;return Response.json({runReceipt:options.missingReceipt?{confirmed:false}:{confirmed:true,auditRecorded:true,requestId:'req_1234abcd'},ticket:{id:ticketId,site_id:'site'},health:{diagnosis:{repairActions:['managed_domain_repair']}}});}
  if(path==='/api/support/remediate')return Response.json({result:{status:'succeeded',verified:!options.unverified,audited:true},ticketResolution:{resolved:!options.unresolved,audited:true,centralResolutionVerified:!options.missingCentralResolution}});
  if(path==='/site/slug')return new Response(options.badPublic?'stale':'updated-marker');
  if(path==='/api/support/tickets')return Response.json({tickets:[{id:ticketId,status:'resolved'}]});
  throw new Error('unexpected route');
 };
 const m={exports:{}};
 new Function('module','exports','require','fetch',code)(m,m.exports,()=>({verifyManagedRepair:async()=>!options.independentFailure,verifySupportTicketInRun:async(_ticket,_request,status)=>status==='resolved'?!options.missingResolvedReadback:!options.missingCentralReadback,reconcileCentralSupportForTicket:async(db,userId,siteId,id)=>{assert.equal(db,service);assert.equal(userId,"owner");assert.equal(siteId,"site");assert.equal(id,ticketId);return {ok:!options.reconciliationFailure,scanned:1,checked:1,completed:options.replayedCompletion?1:0,confirmed:1,alreadyConfirmed:0};},runSupportRemediationSweepForSite:async(db,userId,siteId)=>{assert.equal(db,service);scopes.push({userId,siteId});return {ok:!options.unverified,scanned:options.globalScan?2:1,attempted:1,succeeded:1,failed:options.unverified?1:0,ticketsResolved:options.unresolved?0:1,centralResolutionsVerified:options.missingCentralResolution?0:1};}}),fakeFetch);
 const promise=m.exports.runCustomerSupportE2E({service,origin:'https://eltara.example/api/admin/builder-e2e',customerToken:'customer-token',userId:'owner',siteId:'site',slug:'slug',publicMarker:'updated-marker',repairMode:options.scheduled?'scheduled':'customer',onPendingCentralResolution:id=>retention.push(['pending',id]),onCentralResolution:()=>retention.push(['resolved'])});
 return {calls,promise,retention,scopes};
}
test('support recipe verifies automatic product resolution with only the customer token',async()=>{
 const {calls,promise}=await run();const result=await promise;assert.equal(result.closure,'automatic_central_resolution');assert.equal(result.automaticProductResolutionVerified,true);assert.equal(result.centralResolutionVerified,true);assert.equal(result.centralCockpitVerified,true);assert.equal(result.automaticClosureVerified,true);
 assert.equal(calls.some(x=>x[0]==='/api/admin/support'),false);assert.equal(calls[0][2],'Bearer customer-token');
});
test('failed repair verification prevents accepting the automatic resolution',async()=>{
 for(const options of [{unverified:true},{independentFailure:true}]){const {calls,promise}=await run(options);await assert.rejects(promise,/repair_unconfirmed/);assert.equal(calls.some(x=>x[0]==='/api/admin/support'),false);}
});
test('missing public content fails the journey even after successful database repair',async()=>{
 const {calls,promise}=await run({badPublic:true});await assert.rejects(promise,/public_result_unconfirmed/);assert.equal(calls.some(x=>x[0]==='/api/admin/support'),false);
});
test('missing durable audit fails the recipe even if the ticket is already resolved',async()=>{
 const {promise}=await run({missingAudit:true});await assert.rejects(promise,/durable_evidence_unconfirmed/);
});

test('missing central receipt prevents accepting the complete support journey',async()=>{
 const {calls,promise}=await run({missingReceipt:true});await assert.rejects(promise,/central_receipt_unconfirmed/);assert.equal(calls.some(x=>x[0]==='/api/admin/support'),false);
});

test('a POST receipt without independent cockpit readback cannot pass the journey',async()=>{
 const {calls,promise}=await run({missingCentralReadback:true});await assert.rejects(promise,/central_readback_unconfirmed/);assert.equal(calls.some(x=>x[0]==='/api/support/remediate'),false);
});

test('missing automatic resolution receipt fails without operator fallback',async()=>{const {calls,promise}=await run({unresolved:true});await assert.rejects(promise,/automatic_resolution_unconfirmed/);assert.equal(calls.some(x=>x[0]==='/api/admin/support'),false);});

test('product resolution alone and a central POST without resolved readback cannot pass before cleanup',async()=>{
 for(const options of [{missingCentralResolution:true},{missingResolvedReadback:true}]){
  const {promise}=await run(options);await assert.rejects(promise,/central_resolution_unconfirmed/);
 }
});
test('source cleanup is released only after independently verified central completion',async()=>{
 const success=await run();await success.promise;assert.equal(success.retention[0][0],'pending');assert.deepEqual(success.retention[1],['resolved']);
 for(const options of [{missingCentralResolution:true},{missingResolvedReadback:true},{missingReceipt:true},{unverified:true}]){
  const failure=await run(options);await assert.rejects(failure.promise);assert.equal(failure.retention[0][0],'pending');assert.equal(failure.retention.length,1);
 }
});

test('scheduled recipe scopes the real sweep to its fixture and requires the system audit before releasing cleanup',async()=>{
 const h=await run({scheduled:true});const result=await h.promise;
 assert.equal(result.repairMode,'scheduled');assert.equal(result.automaticClosureVerified,true);
 assert.deepEqual(h.scopes,[{userId:'owner',siteId:'site'}]);
 assert.equal(h.calls.some(call=>call[0]==='/api/support/remediate'),false);
 assert.deepEqual(h.retention[1],['resolved']);
});
test('scheduled recipe retains source evidence on broad scans, wrong trigger or incomplete closure',async()=>{
 for(const options of [{globalScan:true},{wrongTrigger:true},{unverified:true},{unresolved:true},{missingCentralResolution:true},{missingResolvedReadback:true},{reconciliationFailure:true},{replayedCompletion:true}]){
  const h=await run({...options,scheduled:true});await assert.rejects(h.promise);
  assert.equal(h.retention.length,1);assert.equal(h.retention[0][0],'pending');
 }
});

test('release recipe assigns EN to the scoped scheduled flow and retains FR customer flow',()=>{
 const route=fs.readFileSync(new URL('../app/api/admin/builder-e2e/route.ts',import.meta.url),'utf8');
 assert.match(route,/repairMode: locale === "en" \? "scheduled" : "customer"/);
});
