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

test('webhook uses settled one-time payment predicate',()=>{
  assert.match(webhook,/paidAiLaunchCheckout\(session\)/);
});

test('duplicate Stripe events cannot reset an already consumed BUILD entitlement',()=>{
  assert.match(webhook,/onConflict: "external_reference", ignoreDuplicates: true/);
  assert.match(webhook,/\.select\("id"\)/);
  assert.match(webhook,/inserted\.length === 0/);
  assert.match(webhook,/"already_granted"/);
});

test('unknown webhook insert outcome must fail closed, not claim success',()=>{
  assert.match(webhook,/if \(!Array\.isArray\(inserted\)\) throw new Error\("ai_launch_grant_unconfirmed"\)/);
});

test('Checkout subscription projection must be restricted to the authenticated owner',()=>{
  assert.match(checkout,/\.from\("site_subscriptions"\)[\s\S]*?\.eq\("site_id", site\.id\)\s*\.eq\("owner_id", auth\.user\.id\)\s*\.maybeSingle\(\)/);
});

test('Checkout rejects malformed existing BUILD quota records',()=>{
  assert.match(checkout,/Number\.isSafeInteger\(row\.operations_total\)/);
  assert.match(checkout,/Number\.isSafeInteger\(row\.operations_used\)/);
  assert.match(checkout,/code: "ai_launch_entitlement_unverifiable"/);
  assert.match(checkout,/Number\.isFinite\(Date\.parse\(row\.expires_at\)\)/);
});

test('unverifiable active entitlement blocks checkout instead of causing a duplicate purchase',()=>{
  assert.match(checkout,/if \(malformedLaunch\)/);
  assert.ok(checkout.indexOf('if (malformedLaunch)') < checkout.indexOf('createStripeOneTimeCheckout({'));
});

test('Checkout requires a confirmed readable BUILD ledger before starting payment',()=>{
  assert.match(checkout,/if \(launchError \|\| !Array\.isArray\(launchRows\)\)/);
  assert.match(checkout,/code: "ai_launch_ledger_unavailable"/);
  assert.ok(checkout.indexOf('code: "ai_launch_ledger_unavailable"') < checkout.indexOf('createStripeOneTimeCheckout({'));
});

test('Essential customers see a non-mandatory Growth upgrade path',()=>{
  const plans=fs.readFileSync(new URL('../app/plans/page.tsx',import.meta.url),'utf8');
  assert.match(plans,/current\.planKey === "essential"/);
  assert.match(plans,/Vous pouvez rester sur Essentiel sans limite de durée/);
  assert.match(plans,/href="\/growth"/);
  assert.match(plans,/beginPlanChange\("growth", "monthly"\)/);
  assert.match(plans,/sans achat AI Launch obligatoire/);
});

test('Growth locked state offers honest illustrative preview without calling AI',()=>{
  const growth=fs.readFileSync(new URL('../app/growth/page.tsx',import.meta.url),'utf8');
  assert.match(growth,/Aperçu illustratif · pas un diagnostic de votre site/);
  assert.match(growth,/sans analyse de vos données ni appel IA facturé/);
  assert.match(growth,/state === "locked"/);
  assert.match(growth,/!betaActive \? \(/);
});
