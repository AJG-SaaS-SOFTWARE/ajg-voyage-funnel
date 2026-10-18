import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../lib/ordinary-e2e-account.ts',import.meta.url),'utf8');
const module={exports:{}};
new Function('module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(module,module.exports);
const {ordinaryE2EAccount}=module.exports;
function fixture(options={}) {
 const calls=[];
 const service={auth:{admin:{
 async createUser(input){calls.push(['create',input]);return {data:{user:{id:'ordinary'}},error:null};},
 async deleteUser(id){calls.push(['delete',id]);return {error:options.deleteError||null};}
 }}};
 const client={auth:{
 async signInWithPassword(){calls.push(['signin']);return {data:{user:{id:'ordinary'},session:options.signInError?null:{access_token:'synthetic-token'}},error:options.signInError||null};},
 async signOut(input){calls.push(['signout',input]);return {error:options.signOutError||null};}
 },from(table){assert.equal(table,'user_roles');return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:options.role?{role:options.role}:null,error:options.roleError||null};}};},
 async rpc(name){assert.equal(name,'get_my_beta_access');return {data:options.beta===undefined?[]:options.beta,error:options.betaError||null};}};
 return {calls,account:ordinaryE2EAccount(service,client)};
}
test('ordinary fixture returns a nonprivileged session and revokes it before deletion',async()=>{
 const f=fixture();const result=await f.account.provision();assert.equal(result.user.id,'ordinary');assert.equal(result.token,'synthetic-token');
 const created=f.calls[0][1];assert.equal(created.app_metadata.purpose,'eltara_ordinary_customer_e2e');assert.equal(created.user_metadata,undefined);assert.equal(created.app_metadata.role,undefined);
 assert.equal(await f.account.cleanup(),true);assert.deepEqual(f.calls.slice(-2),[['signout',{scope:'global'}],['delete','ordinary']]);
});
test('admin, beta and unknown evidence cannot qualify as an ordinary account',async()=>{
 for(const options of [{role:'admin'},{beta:[{active:true}]},{beta:null},{beta:[{}]},{roleError:{code:'synthetic'}},{betaError:{code:'synthetic'}}]){
 const f=fixture(options);await assert.rejects(f.account.provision(),/privileges_unconfirmed/);assert.equal(await f.account.cleanup(),true);assert.equal(f.calls.at(-1)[0],'delete');}
});
test('explicitly inactive beta result qualifies without a beta grant',async()=>{
 const f=fixture({beta:[{active:false}]});await f.account.provision();assert.equal(await f.account.cleanup(),true);
});
test('sign-in failure retains the created account for cleanup',async()=>{
 const f=fixture({signInError:{message:'synthetic'}});await assert.rejects(f.account.provision(),/sign_in_failed/);assert.equal(await f.account.cleanup(),true);assert.deepEqual(f.calls.at(-1),['delete','ordinary']);
});
test('revocation failure still attempts deletion and does not claim successful cleanup',async()=>{
 for(const options of [{signOutError:{code:'synthetic'}},{deleteError:{code:'synthetic'}}]){const f=fixture(options);await f.account.provision();assert.equal(await f.account.cleanup(),false);assert.deepEqual(f.calls.at(-1),['delete','ordinary']);}
});
test('pending central resolution preserves source evidence but revokes the disposable session',async()=>{
 const f=fixture();await f.account.provision();assert.equal(await f.account.cleanup({preserveAccount:true}),true);
 assert.deepEqual(f.calls.at(-1),['signout',{scope:'global'}]);assert.equal(f.calls.some(call=>call[0]==='delete'),false);
});
