import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../lib/private-beta-access.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const paid={owner_id:'owner',plan_key:'essential',status:'active',first_payment_confirmed_at:'2026-01-01T00:00:00Z'};
async function entry(rows,options={}){
 const queries=[];
 const client={auth:{getUser:async()=>({data:{user:options.unsigned?null:{id:'owner'}},error:null})},rpc:async()=>({data:options.beta?[{active:true}]:[],error:null}),
 from(table){const query={select(columns){queries.push([table,'select',columns]);return query;},eq(key,value){queries.push([table,key,value]);return query;},maybeSingle:async()=>({data:options.admin?{role:'admin'}:null,error:null}),limit:async()=>({data:rows,error:options.error||null})};return query;}};
 const m={exports:{}};new Function('module','exports','require',code)(m,m.exports,()=>({getSupabaseBrowserClient:()=>client}));
 return {result:await m.exports.getPrivateBetaAccess(),queries};
}
test('a paid ordinary customer can enter without receiving admin or beta rights',async()=>{
 const {result,queries}=await entry([paid]);assert.equal(result.allowed,true);assert.equal(result.paidCustomer,true);assert.equal(result.admin,false);assert.equal(result.betaActive,false);
 assert.ok(queries.some(q=>q[0]==='site_subscriptions'&&q[1]==='owner_id'&&q[2]==='owner'));
});
test('unpaid, foreign, invalid, canceled and unknown subscription evidence never grants entry',async()=>{
 for(const row of [{...paid,owner_id:'other'},{...paid,first_payment_confirmed_at:null},{...paid,first_payment_confirmed_at:'invalid'},{...paid,first_payment_confirmed_at:'2999-01-01'},{...paid,status:'canceled'},{...paid,status:'trialing'},{...paid,plan_key:'free'}]){
 const {result}=await entry([row]);assert.equal(result.allowed,false);assert.equal(result.paidCustomer,false);}
 for(const rows of [null,undefined,[]])assert.equal((await entry(rows)).result.allowed,false);
 assert.equal((await entry([paid],{error:{code:'synthetic'}})).result.allowed,false);
});
test('past-due customers can enter to regularize, without altering feature guards',async()=>{
 const {result}=await entry([{...paid,status:'past_due'}]);assert.equal(result.allowed,true);assert.equal(result.betaActive,false);
});
test('invited beta and admin access remain independent; unsigned clients do not query subscriptions',async()=>{
 for(const options of [{beta:true},{admin:true}])assert.equal((await entry(null,{...options,error:{code:'synthetic'}})).result.allowed,true);
 const unsigned=await entry([paid],{unsigned:true});assert.equal(unsigned.result.allowed,false);assert.deepEqual(unsigned.queries,[]);
});
