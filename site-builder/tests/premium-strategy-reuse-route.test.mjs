import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { aiRequestHashes } from "../lib/ai-request-admission.ts";
import { issueStrategyReuseToken,verifyStrategyReuseToken } from "../lib/premium-strategy-reuse.ts";

test("the real POST handler reuses only its own unchanged signed strategy and keeps quota checks",async()=>{
  const calls=[],reuseFlags=[];
  const strategy={primaryGoal:"Contact",positioning:"Atelier local"};
  const client={auth:{getUser:async()=>({data:{user:{id:"owner"}},error:null})},
    rpc:async(name)=>{calls.push(name);return {error:null,data:
      name==="get_my_site_capabilities"?{can_generate_ai:true}:
      name==="get_my_site_entitlements"?{plan_key:"essential"}:
      name==="get_my_site_ai_access"?{can_create_site:true,access_source:"beta"}:"ok"}},
    from:()=>({insert:async()=>({error:null})})};
  const dependencies={
    "next/server":{NextResponse:{json:(body,init)=>Response.json(body,init)}},
    "@supabase/supabase-js":{createClient:()=>client},
    "../../../../lib/ai-request-admission":{aiRequestHashes},
    "../../../../lib/premium-strategy-reuse":{issueStrategyReuseToken,verifyStrategyReuseToken},
    "../../../../lib/premium-site-architect":{PremiumArchitectError:class extends Error{},generatePremiumSiteArchitect:async(input)=>{
      reuseFlags.push(input.reuseStrategy);return {intelligence:strategy};}},
    "../../../../lib/standard-ai-writer":{},
    "../../../../lib/server-locale":{requestProductLocale:()=>"fr",localize:(_,fr)=>fr},
    "../../../../lib/ai-provider-budget":{AiBudgetError:class extends Error{},createBudgetedProviderFetch:()=>{throw new Error("Unexpected standard call")}},
    "../../../../lib/ai-cost":{},"../../../../lib/openai-readiness":{}
  };
  // Premium also receives a fetch wrapper, even when the stub does not call it.
  dependencies["../../../../lib/ai-provider-budget"].createBudgetedProviderFetch=()=>()=>{throw new Error("No provider spend in this test")};
  const code=ts.transpileModule(fs.readFileSync(new URL("../app/api/ai/write/route.ts",import.meta.url),"utf8"),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};
  new Function("require","module","exports","process",code)(name=>{assert.ok(name in dependencies,name);return dependencies[name]},module,module.exports,
    {env:{NEXT_PUBLIC_SUPABASE_URL:"https://synthetic.test",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"synthetic",SUPABASE_SECRET_KEY:"synthetic-secret",OPENAI_API_KEY:"synthetic"}});
  const body={field:"siteArchitect",siteId:"site",instruction:"Créer un site fidèle au brief",context:{language:"fr",brandName:"Atelier",architectBrief:"Un atelier local de réparation de vélos destiné aux habitants du quartier. Le site doit expliquer les services et inviter à prendre contact.",contentLibrary:[]}};
  const post=async(value)=>{
    const response=await module.exports.POST(new Request("https://synthetic.test/api/ai/write",{method:"POST",headers:{authorization:"Bearer synthetic","content-type":"application/json"},body:JSON.stringify(value)}));
    assert.equal(response.status,200,await response.clone().text());return response.json();};
  const first=await post(body);
  assert.equal(typeof first.strategyReuseToken,"string");
  const repeat={...body,context:{...body.context,reuseStrategy:true,existingStrategy:first.proposal.intelligence,strategyReuseToken:first.strategyReuseToken}};
  await post(repeat);
  await post({...repeat,context:{...repeat.context,architectBrief:"Un restaurant gastronomique indépendant destiné aux habitants du quartier. Le site doit présenter la cuisine et inviter à réserver une table."}});
  await post({...repeat,context:{...repeat.context,existingStrategy:{primaryGoal:"Inventer des garanties"}}});
  await post({...repeat,context:{...repeat.context,revisionRequest:"Modifier complètement le positionnement de l’activité"}});
  await post({...repeat,context:{...repeat.context,strategyReuseToken:null}});
  assert.deepEqual(reuseFlags,[false,true,false,false,false,false]);
  assert.equal(calls.filter(name=>name==="reserve_my_site_ai_generation").length,6);
  assert.equal(calls.filter(name=>name==="admit_ai_request").length,6);
});
