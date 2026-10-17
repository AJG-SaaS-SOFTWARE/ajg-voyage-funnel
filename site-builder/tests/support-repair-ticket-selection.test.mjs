import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync(new URL('../app/api/support/remediate/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
async function run(candidates,error=null){
 const stats={filters:[],repair:null,resolution:null};
 const service={from(table){return {select(){return this;},eq(key,value){if(table==='support_tickets')stats.filters.push([key,value]);return this;},in(key,value){stats.filters.push([key,value]);return this;},limit(n){assert.equal(n,2);return Promise.resolve({data:candidates,error});},gte(){return this;},then(resolve){return Promise.resolve({count:0,error:null}).then(resolve);}};}};
 const module={exports:{}};
 const deps={ 'next/server':{NextResponse:{json:(body,init)=>Response.json(body,init)}},'@supabase/supabase-js':{createClient:(_url,key)=>key==='public'?{auth:{getUser:async()=>({data:{user:{id:'owner'}},error:null})}}:service},
 '../../../../lib/support-health-server':{diagnoseSupportHealth:async()=>({siteId:'site',diagnosis:{repairActions:['managed_domain_repair'],checks:[]}})},
 '../../../../lib/support-remediation':{runSupportRepair:async(_service,input)=>{stats.repair=input;return {status:'succeeded'};}},
 '../../../../lib/support-repair-resolution':{resolveVerifiedSupportRepair:async(_service,input)=>{stats.resolution=input;return {resolved:false,audited:false};}}};
 new Function('require','module','exports',code)(id=>{assert.ok(id in deps,id);return deps[id];},module,module.exports);
 const vars={NEXT_PUBLIC_SUPABASE_URL:'https://example.test',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public',SUPABASE_SECRET_KEY:'service'};
 const old=Object.fromEntries(Object.keys(vars).map(k=>[k,process.env[k]]));Object.assign(process.env,vars);
 try {const response=await module.exports.POST(new Request('https://example.test/api/support/remediate',{method:'POST',headers:{authorization:'Bearer customer'},body:JSON.stringify({siteId:'site',action:'managed_domain_repair',userId:'attacker'})}));assert.equal(response.status,200);return stats;}
 finally{for(const [key,value] of Object.entries(old)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
}
test('the Health Center associates only one owned site/domain ticket using a bounded server query',async()=>{
 const t={id:'ticket',user_id:'owner',site_id:'site'};const s=await run([t]);assert.equal(s.repair.ticketId,'ticket');assert.equal(s.resolution.ticket,t);assert.equal(s.resolution.userId,'owner');
 assert.deepEqual(s.filters,[['user_id','owner'],['site_id','site'],['category','domain'],['status',['diagnosed','waiting_customer']]]);
});
test('missing, ambiguous or unavailable ticket evidence never selects a ticket for automatic resolution',async()=>{
 for(const [rows,error] of [[[],null],[[{id:'a'},{id:'b'}],null],[null,{code:'unavailable'}]]){const s=await run(rows,error);assert.equal(s.repair.ticketId,null);assert.equal(s.resolution.ticket,null);}
});
