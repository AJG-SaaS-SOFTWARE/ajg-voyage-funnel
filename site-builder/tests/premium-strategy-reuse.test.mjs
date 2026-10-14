import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { issueStrategyReuseToken, verifyStrategyReuseToken } from "../lib/premium-strategy-reuse.ts";
const now=Date.parse("2026-10-14T19:00:00Z");
const secret="synthetic-server-secret";
const scope={userId:"owner-1",siteId:"site-1",source:{brief:"Atelier de réparation",language:"French",assets:[]}};
const strategy={primaryGoal:"Prise de contact",positioning:"Service de proximité"};
test("a signed strategy is reusable for the same source even if object keys are reordered",()=>{
  const token=issueStrategyReuseToken(scope,strategy,secret,now);
  assert.equal(verifyStrategyReuseToken(scope,strategy,token,secret,now+1000),true);
  assert.equal(verifyStrategyReuseToken({...scope,source:{assets:[],language:"French",brief:"Atelier de réparation"}},strategy,token,secret,now+1000),true);
  assert.doesNotMatch(token,/owner-1|site-1|Atelier|synthetic-server-secret/);
});
test("changed owner, website, brief, language, assets or strategy forces fresh strategy analysis",()=>{
  const token=issueStrategyReuseToken(scope,strategy,secret,now);
  for(const changed of [{...scope,userId:"owner-2"},{...scope,siteId:"site-2"},
    {...scope,source:{...scope.source,brief:"Restaurant"}},
    {...scope,source:{...scope.source,language:"English"}},
    {...scope,source:{...scope.source,assets:[{id:"new-image"}]}}]){
    assert.equal(verifyStrategyReuseToken(changed,strategy,token,secret,now),false);
  }
  assert.equal(verifyStrategyReuseToken(scope,{...strategy,positioning:"Certification inventée"},token,secret,now),false);
  assert.equal(verifyStrategyReuseToken(scope,strategy,token,"another-secret",now),false);
});
test("missing, malformed, altered and expired tokens cannot skip paid strategy checks",()=>{
  const token=issueStrategyReuseToken(scope,strategy,secret,now);
  for(const invalid of [null,{},"",token.replace(/.$/,c=>c==="0"?"1":"0"),token.replace(/^\d+/,String(now+99_000_000))]){
    assert.equal(verifyStrategyReuseToken(scope,strategy,invalid,secret,now),false);
  }
  assert.equal(verifyStrategyReuseToken(scope,strategy,token,secret,now+7_200_000),false);
});
test("API and client transport the signature while keeping all proposal QA gates",()=>{
  const route=fs.readFileSync(new URL("../app/api/ai/write/route.ts",import.meta.url),"utf8");
  const builder=fs.readFileSync(new URL("../app/builder/page.tsx",import.meta.url),"utf8");
  assert.match(route,/verifyStrategyReuseToken\(strategyScope, existingStrategy, context\.strategyReuseToken, serviceKey\)/);
  assert.match(route,/issueStrategyReuseToken\(strategyScope, proposal\.intelligence, serviceKey\)/);
  assert.match(builder,/strategyReuseToken: canReuseStrategy \? architectStrategyReuseToken : null/);
  const pipeline=fs.readFileSync(new URL("../lib/premium-site-architect.ts",import.meta.url),"utf8");
  assert.match(pipeline,/premium_final_review/);assert.match(pipeline,/finalDeterministicBlocking\.length === 0/);
});
