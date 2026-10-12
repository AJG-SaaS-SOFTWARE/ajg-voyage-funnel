import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const raw = fs.readFileSync(new URL('../lib/stripe-ai-launch-payment.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(raw, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const ref = { exports: {} };
new Function('require','module','exports',code)(require,ref,ref.exports);
const { paidAiLaunchCheckout } = ref.exports;
const valid = {id:'cs_test_123',mode:'payment',payment_status:'paid',metadata:{purchase_type:'ai_launch'}};
test('only verified paid one-time AI Launch session is eligible',()=>{
  assert.equal(paidAiLaunchCheckout(valid),true);
  for(const changed of [
    {payment_status:'unpaid'},{payment_status:'no_payment_required'},
    {mode:'subscription'},{mode:'setup'},{id:'not_checkout'},
    {metadata:{purchase_type:'other'}},{metadata:{}}
  ]) assert.equal(paidAiLaunchCheckout({...valid,...changed}),false);
  assert.equal(paidAiLaunchCheckout(null),false);
});
