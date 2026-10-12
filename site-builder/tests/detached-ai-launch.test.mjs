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

test('detached BUILD route prohibits free field writing and GROW without RUN',()=>{
  const route=fs.readFileSync(new URL('../app/api/ai/write/route.ts',import.meta.url),'utf8');
  assert.match(route,/requestPlanKey === "free" && capability\?\.can_generate_ai/);
  assert.match(route,/!\["siteArchitect", "siteRevision"\]\.includes\(field\)/);
  assert.match(route,/detached\?\.access_source !== "ai_launch"/);
  assert.match(route,/Number\(detached\?\.launch_operations_remaining\) <= 0/);
  assert.match(route,/AJG_DETACHED_AI_LAUNCH_ENABLED/);
  assert.match(route,/reserveLaunchOperation/);
  assert.match(route,/createBudgetedProviderFetch/);
});

test('detached paid BUILD uses bounded quota admission and excludes free users',()=>{
  const quota=fs.readFileSync(new URL('../docs/migrations/20261012_detached_build_quota_admission.sql',import.meta.url),'utf8');
  assert.match(quota,/l\.source='stripe_purchase'/);
  assert.match(quota,/l\.operations_total>l\.operations_used/);
  assert.match(quota,/v_minute:=1; v_daily:=4; v_monthly:=12/);
  assert.match(quota,/pg_advisory_xact_lock/);
  assert.match(quota,/where s\.id=p_site_id and s\.owner_id=v_user_id and s\.privacy_state='active'/);
  assert.match(quota,/where c\.can_generate_ai/);
});

test('AI never spends when plan lookup fails or is missing',()=>{
  const route=fs.readFileSync(new URL('../app/api/ai/write/route.ts',import.meta.url),'utf8');
  assert.match(route,/if \(entitlementError\)/);
  assert.match(route,/code: "entitlement_unavailable"/);
  assert.match(route,/if \(!requestEntitlement\)/);
  assert.match(route,/code: "entitlement_missing"/);
  assert.ok(route.indexOf('code: "entitlement_missing"') < route.indexOf('createBudgetedProviderFetch({'));
});

test('unknown plan cannot reach the expensive provider call',()=>{
  const route=fs.readFileSync(new URL('../app/api/ai/write/route.ts',import.meta.url),'utf8');
  assert.match(route,/!\["free", "essential", "growth"\]\.includes\(requestPlanKey\)/);
  assert.match(route,/code: "invalid_plan"/);
  assert.ok(route.indexOf('code: "invalid_plan"') < route.indexOf('createBudgetedProviderFetch({'));
});

test('detached BUILD requires an unexpired Stripe-purchased entitlement',()=>{
  const route=fs.readFileSync(new URL('../app/api/ai/write/route.ts',import.meta.url),'utf8');
  assert.match(route,/\.eq\("source", "stripe_purchase"\)/);
  assert.match(route,/\.eq\("owner_id", auth\.user\.id\)/);
  assert.match(route,/row\.operations_total > row\.operations_used/);
  assert.match(route,/Date\.parse\(row\.expires_at\) > nowMs/);
  assert.match(route,/\|\| !hasPaidLaunch/);
});

test('webhook grants BUILD only after explicit settled one-time payment',()=>{
  const webhook=fs.readFileSync(new URL('../app/api/billing/stripe-webhook/route.ts',import.meta.url),'utf8');
  assert.match(webhook,/const paid = session\?\.payment_status === "paid"/);
  assert.match(webhook,/const oneTimePayment = session\?\.mode === "payment"/);
  assert.match(webhook,/if \(isAiLaunch && oneTimePayment && paid && siteId && ownerId\)/);
  assert.doesNotMatch(webhook,/session\?\.payment_status === "paid" \|\|\s*event\.type === "checkout\.session\.async_payment_succeeded"/);
});
