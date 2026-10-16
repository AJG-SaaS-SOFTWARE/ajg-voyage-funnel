import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { uniquePageKey } from "../lib/page-key.ts";
import { normalizePremiumProposal } from "../lib/premium-site-architect.ts";
const core = { heroTitle: "Atelier local", heroSubtitle: "Réparation de vélos à Nantes", aboutText: "Un atelier sur rendez-vous." };

test("maximum-length page collisions terminate in both normalizers within a process deadline", () => {
  const script = `
    import fs from 'node:fs'; import ts from 'typescript';
    import {uniquePageKey} from './lib/page-key.ts';
    import {normalizePremiumProposal} from './lib/premium-site-architect.ts';
    const code=ts.transpileModule(fs.readFileSync('./lib/site-config.ts','utf8'),{
      compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    const module={exports:{}};
    new Function('require','module','exports',code)(name=>{
      if(name==='./page-key')return {uniquePageKey};
      if(name==='./site-design')return {defaultSiteDesign:{}};
      if(name==='./site-legal')return {defaultSiteLegalConfig:{}};
      throw Error(name);
    },module,module.exports);
    const pages=Array.from({length:6},(_,i)=>({id:'x'.repeat(60),kind:'custom',slug:'s'.repeat(60),title:'Service '+i,enabled:true}));
    const premium=normalizePremiumProposal({heroTitle:"Atelier",heroSubtitle:"À Nantes",aboutText:"Réparation",architecture:{mode:'multi',pages}},[]).architecture;
    const editor=module.exports.normalizeSiteArchitecture({mode:'multi',pages:pages.map((p,i)=>({...p,id:'page-'+i}))});
    process.stdout.write(JSON.stringify([premium,editor]));
  `;
  const output = execFileSync(process.execPath,["--input-type=module","-e",script],{
    cwd:fileURLToPath(new URL("..",import.meta.url)),timeout:5000,encoding:"utf8",stdio:["ignore","pipe","pipe"]
  });
  for (const architecture of JSON.parse(output)) {
    assert.equal(architecture.pages.length,6);
    assert.equal(architecture.pages.filter(page=>page.kind==='home').length,1);
    assert.equal(new Set(architecture.pages.map(page=>page.id)).size,6);
    assert.equal(new Set(architecture.pages.map(page=>page.slug)).size,6);
    assert.ok(architecture.pages.every(page=>page.id.length<=60&&page.slug.length<=60));
  }
});

test("bounded suffixes remain unique at two-digit collisions and preserve available keys", () => {
  const used=new Set(); const base='p'.repeat(60);
  const keys=Array.from({length:20},()=>uniquePageKey(base,used));
  assert.equal(keys[0],base); assert.equal(keys[1],'p'.repeat(58)+'-2');
  assert.equal(keys[19],'p'.repeat(57)+'-20');
  assert.equal(new Set(keys).size,20); assert.ok(keys.every(key=>key.length===60));
  assert.equal(uniquePageKey('services',used),'services');
  const hyphenated = 'a'.repeat(57) + '-bc';
  const collisions = new Set([hyphenated]);
  assert.equal(uniquePageKey(hyphenated,collisions),'a'.repeat(57)+'-2');
});

test("an inserted home page has a unique ID and never exceeds the six-page bound", () => {
  const pages=Array.from({length:6},(_,i)=>({id:i===0?'home':`page-${i}`,slug:`service-${i}`,kind:'custom',title:`Service ${i}`}));
  const result=normalizePremiumProposal({...core,architecture:{mode:'multi',pages}},[]).architecture;
  assert.equal(result.pages.length,6); assert.equal(result.pages[0].kind,'home');
  assert.equal(result.pages[0].id,'home-2'); assert.equal(result.pages[1].id,'home');
  const stable=normalizePremiumProposal({...core,architecture:{mode:'multi',pages:[{id:'start',slug:'',kind:'home'},...pages.slice(1)]}},[]);
  assert.equal(stable.architecture.pages.length,6); assert.equal(stable.architecture.pages[0].id,'start');
});

test("AI page assignments require the product's actual publication-rights evidence", () => {
  const assets=[
    {id:'owned',publishable:true,rights:'owned'},
    {id:'licensed',publishable:true,rights:'licensed',sourceUrl:'https://example.test/license'},
    {id:'public',publishable:true,rights:'public-domain',sourceUrl:'https://example.test/source'},
    {id:'unknown',publishable:true,rights:'unknown'},
    {id:'invented',publishable:true,rights:'anything'},
    {id:'no-source',publishable:true,rights:'licensed'},
    {id:'bad-source',publishable:true,rights:'public-domain',sourceUrl:'http://example.test'},
    {id:'refused',publishable:false,rights:'owned'}
  ];
  const raw={architecture:{mode:'single',pages:[{id:'home',kind:'home',assetIds:assets.map(asset=>asset.id)}]}};
  assert.deepEqual(normalizePremiumProposal({...core,...raw},assets).architecture.pages[0].assetIds,['owned','licensed','public']);
});
