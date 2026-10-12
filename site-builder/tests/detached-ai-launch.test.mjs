import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql=fs.readFileSync(new URL('../docs/migrations/20261012_detached_ai_launch_build_only.sql',import.meta.url),'utf8');
const checkout=fs.readFileSync(new URL('../app/api/billing/checkout/route.ts',import.meta.url),'utf8');
const webhook=fs.readFileSync(new URL('../app/api/billing/stripe-webhook/route.ts',import.meta.url),'utf8');
test('purchased BUILD can gain AI without granting RUN publication',()=>{
  assert.match(sql,/l\.source='stripe_purchase'/);
  assert.match(sql,/l\.operations_total>l\.operations_used/);
  assert.match(sql,/or \(purchased_launch and state='free'\)/);
  assert.match(sql,/privacy_state='active' and ever_paid_or_beta\s+and \(\(current_paid_or_beta and state='active'\) or state='grace'\)/);
  assert.match(sql,/privacy_state='active' and ever_paid_or_beta\s+and state in \('active','grace','restricted'\)/);
});
test('checkout and webhook must both require explicit detached BUILD flag',()=>{
  assert.match(checkout,/AJG_DETACHED_AI_LAUNCH_ENABLED/);
  assert.match(webhook,/AJG_DETACHED_AI_LAUNCH_ENABLED/);
  assert.match(webhook,/input\.source !== "stripe_purchase"/);
});
