import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../components/PublicContactForm.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX
} }).outputText;
const id = "00000000-0000-4000-8000-000000000001";
const values = { name:"Visitor",email:"visitor@example.invalid",subject:"Question",message:"An isolated fixture question.",consent:"on",website:"" };
const receipt = notification => ({ ok:true,id,notification });

function fixture(send, { english=false, analyticsFails=false, resetFails=false }={}) {
  const slots=[],pending=new Map(),requests=[],analytics=[];
  let cursor=0,resets=0;
  const form={ values:{...values},reset(){ resets++; if(resetFails)throw Error("private reset detail"); this.values={}; } };
  const element=(type,props)=>({type,props});
  const dependencies={
    "react/jsx-runtime":{jsx:element,jsxs:element},
    react:{ useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],value=>pending.set(i,value)];},
      useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];} },
    "./PublicAnalyticsTracker":{recordPublicAnalytics(...args){analytics.push(args);if(analyticsFails)throw Error("private analytics detail");}}
  };
  const module={exports:{}};
  class FormValues { constructor(target){this.values={...target.values};} get(key){return this.values[key];} }
  new Function("require","module","exports","fetch","FormData",code)(name=>{
    assert.ok(name in dependencies,name);return dependencies[name];
  },module,module.exports,async (url,options)=>{requests.push({url,...options});return send();},FormValues);
  function render(){for(const [i,value]of pending)slots[i]=value;pending.clear();cursor=0;return module.exports.default({siteId:id,pagePath:"/",email:"publisher@example.invalid",english});}
  function find(node,predicate){if(!node||typeof node!=="object")return;if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const found=find(child,predicate);if(found)return found;}}
  function submit(handler=render().props.onSubmit){const event={preventDefault(){},currentTarget:form};const promise=handler(event);event.currentTarget=null;return promise;}
  return {render,find,submit,requests,analytics,form,get resets(){return resets;},status(){return find(render(),node=>node.props?.["data-state"]);}};
}

for(const english of [false,true]) {
  test(`accepted public contact survives cleared event and keeps an honest receipt (${english?"EN":"FR"})`,async()=>{
    for(const notification of ["stored","sent"]) {
      const f=fixture(async()=>Response.json(receipt(notification),{status:201}),{english});
      await f.submit();assert.equal(f.status().props["data-state"],"success");
      assert.equal(f.resets,1);assert.equal(f.analytics.length,1);assert.equal(f.requests.length,1);
      assert.match(JSON.stringify(f.status()),english?/recorded/:/enregistré/);
      assert.deepEqual(JSON.parse(f.requests[0].body),{siteId:id,...values,consent:true});
    }
  });
  test(`network failure retains contact fields without raw details or an automatic retry (${english?"EN":"FR"})`,async()=>{
    const f=fixture(async()=>{throw Error("private provider detail");},{english});
    await f.submit();assert.equal(f.status().props["data-state"],"error");
    assert.deepEqual(f.form.values,values);assert.equal(f.resets,0);assert.equal(f.analytics.length,0);assert.equal(f.requests.length,1);
    assert.doesNotMatch(JSON.stringify(f.render()),/private provider detail/);
    assert.match(JSON.stringify(f.status()),english?/not.*confirm/:/pas.*confirmé/);
  });
}

test("synchronous contact lock prevents double POST before React commits pending state",async()=>{
  let complete;const deferred=new Promise(resolve=>{complete=resolve;});
  const f=fixture(()=>deferred),handler=f.render().props.onSubmit;
  const one=f.submit(handler),two=f.submit(handler);assert.equal(f.requests.length,1);
  const tree=f.render();
  assert.equal(tree.props["aria-busy"],true);
  for(const name of ["name","email","subject","message","website","consent"]){assert.equal(f.find(tree,node=>node.props?.name===name).props.disabled,true);}
  complete(Response.json(receipt("stored"),{status:201}));await Promise.all([one,two]);
  assert.equal(f.status().props["data-state"],"success");assert.equal(f.resets,1);
});

for(const options of [{analyticsFails:true},{resetFails:true},{analyticsFails:true,resetFails:true}]) {
  test(`ancillary failure cannot revoke confirmed public contact receipt: ${JSON.stringify(options)}`,async()=>{
    const f=fixture(async()=>Response.json(receipt("stored"),{status:201}),options);
    await f.submit();assert.equal(f.status().props["data-state"],"success");assert.equal(f.requests.length,1);
    assert.doesNotMatch(JSON.stringify(f.render()),/private (analytics|reset) detail/);
  });
}

test("unconfirmed successful envelopes never reset fields or count a submission",async()=>{
  for(const body of [null,{}, {ok:false}, {ok:true}, {ok:true,id,notification:"unknown"}, {ok:true,id:1,notification:"stored"}, {ok:true,id:"bad",notification:"stored"}]) {
    const f=fixture(async()=>Response.json(body));await f.submit();
    assert.equal(f.status().props["data-state"],"error");assert.equal(f.resets,0);assert.equal(f.analytics.length,0);assert.deepEqual(f.form.values,values);
  }
  const f=fixture(async()=>new Response("<html>private provider detail</html>"));await f.submit();
  assert.equal(f.status().props["data-state"],"error");assert.equal(f.resets,0);assert.doesNotMatch(JSON.stringify(f.render()),/private provider detail/);
});

test("form start analytics is best effort and cannot throw into interaction",()=>{
  const f=fixture(async()=>Response.json(receipt("stored"),{status:201}),{analyticsFails:true});
  assert.doesNotThrow(()=>f.render().props.onFocusCapture());
  assert.doesNotThrow(()=>f.render().props.onFocusCapture());assert.equal(f.analytics.length,1);
});

test("known server rejections stay localized and only a later manual retry sends again",async()=>{
  for(const english of [false,true]) {
    let attempts=0;const f=fixture(async()=>++attempts===1?Response.json({error:"rate_limited",detail:"private"},{status:429}):Response.json(receipt("stored"),{status:201}),{english});
    await f.submit();assert.equal(f.status().props["data-state"],"error");assert.match(JSON.stringify(f.status()),english?/Too many/:/Trop de/);
    assert.equal(f.requests.length,1);assert.equal(f.resets,0);await f.submit();assert.equal(f.requests.length,2);assert.equal(f.status().props["data-state"],"success");
  }
});

test("unknown errors never use object prototype properties or provider messages",async()=>{
  for(const error of ["__proto__","constructor","private provider detail",{}]) {
    const f=fixture(async()=>Response.json({error},{status:503}));await f.submit();
    assert.equal(f.status().props["data-state"],"error");assert.equal(typeof f.status().props.children,"string");
    assert.doesNotMatch(JSON.stringify(f.render()),/private provider detail/);assert.equal(f.resets,0);
  }
});

test("existing honeypot suppression stays silent but does not count as a stored message",async()=>{
  const f=fixture(async()=>Response.json({ok:true,notification:"suppressed"}));await f.submit();
  assert.equal(f.status().props["data-state"],"success");assert.equal(f.resets,1);assert.equal(f.analytics.length,0);
});
