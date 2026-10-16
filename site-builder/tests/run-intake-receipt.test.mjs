import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../lib/run-intake-reporting.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
async function report(change=x=>x, status=201) {
 const m={exports:{}};
 const fetch=async(url,init)=>{
  assert.equal(url,'https://ajg-infra-cockpit.vercel.app/api/run/intake');
  const payload=JSON.parse(init.body);
  assert.equal(payload.externalRef,'builder-ticket:10000000-0000-4000-8000-000000000001');
  return Response.json(change({ok:true,request:{...payload,id:'req_1234abcd',status:'open'}}),{status});
 };
 new Function('require','module','exports','fetch','process',code)(()=>{throw Error('unexpected import');},m,m.exports,fetch,{env:{AJG_RUN_TOKEN:'synthetic-token'}});
 return m.exports.reportSupportTicketToRun({category:'domain',severity:'high',status:'diagnosed',diagnosis:'incident',sitePresent:true,ticketId:'10000000-0000-4000-8000-000000000001'});
}
test('exact central ticket receipt returns its correlation ID',async()=>assert.deepEqual(await report(),{ok:true,requestId:'req_1234abcd'}));
for(const field of ['product','source','externalRef','title','kind','id','status']) {
 test('mismatched receipt '+field+' cannot prove central delivery',async()=>{
  const result=await report(body=>({...body,request:{...body.request,[field]:'wrong'}}));
  assert.deepEqual(result,{ok:false,reason:'run intake receipt unconfirmed'});
 });
}
test('HTTP success without a positive persisted receipt stays unconfirmed',async()=>{
 for(const body of [{ok:false},{ok:true},{ok:true,request:null}]) assert.equal((await report(()=>body)).ok,false);
});
test('central storage errors are not accepted as receipts',async()=>assert.equal((await report(x=>x,503)).ok,false));
