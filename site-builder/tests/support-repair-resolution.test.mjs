import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {supportRecoveryIsVerified} from '../lib/support-reconcile-policy.ts';
const source=fs.readFileSync(new URL('../lib/support-repair-resolution.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};
new Function('require','module','exports',code)(id=>id==='./support-reconcile-policy'?{supportRecoveryIsVerified}:{preferredPublishedRootDomain:()=> 'example.test'},module,module.exports);
const base={ticket:{id:'ticket',user_id:'owner',site_id:'site',status:'diagnosed',category:'domain',updated_at:'2026-10-17T20:00:00+00:00',diagnosis:{checks:[{key:'domain',status:'action'}]}},
 userId:'owner',siteId:'site',repair:{siteId:'site',status:'succeeded',verified:true,audited:true,code:'managed_domain_primary_repaired'},
 health:{siteId:'site',diagnosis:{checks:['backend','public_render','domain'].map(key=>({key,status:'healthy'}))}}};
function harness(options={}){
 const stats={calls:[],reads:0};const stamp='2026-10-17T21:00:00+00:00',repair='12345678-1234-1234-1234-123456789abc';
 const db={async rpc(name,input){stats.calls.push({name,input});if(options.lost)throw Error('private');return {data:options.refused?null:{ticketId:'ticket',status:'resolved',eventId:'9007199254740993',repairRunId:repair,updatedAt:stamp},error:null};},from(table){stats.reads++;
  return {select(){return this;},eq(){return this;},async maybeSingle(){return {error:null,data:table==='support_tickets'?{id:'ticket',status:'resolved',resolution_code:'auto_verified_managed_primary_repair',updated_at:stamp}:{ticket_id:'ticket',actor_type:'system',event_type:'resolution',metadata:{status:'resolved',resolution_code:'auto_verified_managed_primary_repair',repair_run_id:options.wrongAudit?'other':repair,updated_at:stamp,previous_updated_at:base.ticket.updated_at}}};}};}};
 return {stats,run:input=>module.exports.resolveVerifiedSupportRepair(db,input||structuredClone(base))};
}
test('only verified primary repair resolves an owned diagnosed ticket after correlated readback',async()=>{
 const h=harness();assert.deepEqual(await h.run(),{resolved:true,audited:true});assert.equal(h.stats.calls.length,1);assert.equal(h.stats.reads,2);
 assert.equal(h.stats.calls[0].input.p_expected_updated_at,base.ticket.updated_at);assert.equal(h.stats.calls[0].input.p_user_id,'owner');
});
test('unrelated, terminal, unverified and incompletely recovered tickets cause no SQL resolution',async()=>{
 for(const mutate of [x=>x.ticket=null,x=>x.ticket.user_id='other',x=>x.ticket.status='closed',x=>x.ticket.category='billing',x=>x.ticket.diagnosis={},x=>x.repair.audited=false,x=>x.repair.verified=false,x=>x.repair.code='managed_domain_created_and_verified',x=>x.health.siteId='other',x=>x.health.diagnosis.checks.push({key:'domain',status:'action'})]){
  const input=structuredClone(base);mutate(input);const h=harness();assert.deepEqual(await h.run(input),{resolved:false,audited:false});assert.equal(h.stats.calls.length,0);
 }
});
test('lost ACK, refused CAS and mismatched durable evidence never claim success or retry',async()=>{
 for(const options of [{lost:true},{refused:true},{wrongAudit:true}]){const h=harness(options);assert.deepEqual(await h.run(),{resolved:false,audited:false});assert.equal(h.stats.calls.length,1);}
});
