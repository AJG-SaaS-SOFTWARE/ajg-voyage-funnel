import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

test("active-client BUILD validates a separate 39 EUR price and refuses 49 EUR or recurring prices", async () => {
  const old=process.env.STRIPE_AI_LAUNCH_ACTIVE_CLIENT_PRICE_ID;
  process.env.STRIPE_AI_LAUNCH_ACTIVE_CLIENT_PRICE_ID="price_client";
  let price = { id:"price_client",active:true,currency:"eur",unit_amount:3900,type:"one_time",billing_scheme:"per_unit",product:{active:true,metadata:{app:"ajg_site_builder"}} };
  const code=ts.transpileModule(fs.readFileSync(new URL('../lib/stripe-readiness.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};
  new Function('require','module','exports',code)(name=>{
    assert.equal(name,'./stripe-billing'); return {stripeRequest:async()=>price};
  },module,module.exports);
  try {
    assert.equal((await module.exports.auditAiLaunchActiveClientPrice()).ok,true);
    for(const override of [{unit_amount:4900},{currency:"usd"},{type:"recurring",recurring:{interval:"month"}},{active:false},{id:"wrong"}]) {
      const original=price; price={...price,...override};
      assert.equal((await module.exports.auditAiLaunchActiveClientPrice()).ok,false);
      price=original;
    }
    delete process.env.STRIPE_AI_LAUNCH_ACTIVE_CLIENT_PRICE_ID;
    assert.equal((await module.exports.auditAiLaunchActiveClientPrice()).ok,false);
  } finally { if(old===undefined)delete process.env.STRIPE_AI_LAUNCH_ACTIVE_CLIENT_PRICE_ID;else process.env.STRIPE_AI_LAUNCH_ACTIVE_CLIENT_PRICE_ID=old; }
});
