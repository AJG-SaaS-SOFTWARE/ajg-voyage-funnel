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

test('Growth preview uses the actual owned site publication state without paid AI',()=>{
  const growth=fs.readFileSync(new URL('../app/growth/page.tsx',import.meta.url),'utf8');
  assert.match(growth,/sites\.some\(site => site\.id === siteId\)/);
  assert.match(growth,/sites\.find\(site => site\.id === siteId\)\?\.status === "published"/);
  assert.match(growth,/Information réelle de votre site · sans appel IA/);
  assert.match(growth,/Essentiel suffit pour finaliser et publier/);
});

test('Essential Growth preview uses owned site action link without invoking paid AI',()=>{
  const growth=fs.readFileSync(new URL('../app/growth/page.tsx',import.meta.url),'utf8');
  assert.match(growth,/bookingUrl: typeof site\.config\?\.bookingUrl === "string"/);
  assert.match(growth,/bookingUrl\?\.trim\(\)/);
  assert.match(growth,/aucun lien de réservation ou d’action n’est renseigné/);
  assert.match(growth,/Son fonctionnement et ses performances ne sont pas évalués ici/);
});

test('Essential content preview only checks configured text presence, without an SEO score',()=>{
  const growth=fs.readFileSync(new URL('../app/growth/page.tsx',import.meta.url),'utf8');
  assert.match(growth,/heroTitle: typeof site\.config\?\.heroTitle === "string"/);
  assert.match(growth,/aboutText: typeof site\.config\?\.aboutText === "string"/);
  assert.match(growth,/Sa qualité SEO n’est pas évaluée ici/);
  assert.match(growth,/Vous pouvez le compléter avec Essentiel/);
  assert.match(growth,/Sa pertinence n’est pas analysée ici/);
});

test('billing portal checks owner and no longer advertises obsolete Pro plan',()=>{
  const portal=fs.readFileSync(new URL('../app/api/billing/portal/route.ts',import.meta.url),'utf8');
  assert.match(portal,/\.eq\("site_id", site\.id\)\s*\.eq\("owner_id", auth\.user\.id\)/);
  assert.doesNotMatch(portal,/souscription Pro|Pro subscription/);
});
test('Essential upgrade button accurately describes Stripe portal transition',()=>{
  const plans=fs.readFileSync(new URL('../app/plans/page.tsx',import.meta.url),'utf8');
  assert.match(plans,/Gérer mon passage à Growth dans Stripe/);
});

test('Stripe readiness verifies all Essential and Growth prices are selectable in portal',()=>{
  const readiness=fs.readFileSync(new URL('../lib/stripe-readiness.ts',import.meta.url),'utf8');
  for(const suffix of ['ESSENTIAL_MONTHLY','ESSENTIAL_ANNUAL','GROWTH_MONTHLY','GROWTH_ANNUAL']){
    assert.match(readiness,new RegExp('STRIPE_'+suffix+'_PRICE_ID'));
  }
  assert.match(readiness,/subscription_update\?\.products/);
  assert.match(readiness,/product\.prices\?\.includes\(priceId as string\)/);
});

test('browser billing state selects only subscriptions owned by the selected site owner',()=>{
  const billing=fs.readFileSync(new URL('../lib/billing-access.ts',import.meta.url),'utf8');
  assert.match(billing,/\.from\("site_subscriptions"\)\.select\("provider,provider_customer_id,provider_subscription_id,status"\)\.eq\("site_id", site\.id\)\.eq\("owner_id", site\.ownerId\)/);
});

test('billing state lookup must scope both state and subscription to site owner',()=>{
  const billing=fs.readFileSync(new URL('../lib/billing-access.ts',import.meta.url),'utf8');
  assert.match(billing,/\.from\("site_billing_states"\)[^\n]*\.eq\("site_id", site\.id\)\.eq\("owner_id", site\.ownerId\)/);
  assert.match(billing,/\.from\("site_subscriptions"\)[^\n]*\.eq\("site_id", site\.id\)\.eq\("owner_id", site\.ownerId\)/);
});

test('plan change refreshes billing state before choosing Checkout or Stripe portal',()=>{
  const plans=fs.readFileSync(new URL('../app/plans/page.tsx',import.meta.url),'utf8');
  const begin=plans.slice(plans.indexOf('async function beginPlanChange('),plans.indexOf('async function buyAiLaunch()'));
  assert.match(begin,/const latestBilling = await getMyBillingState\(targetSiteId\)/);
  assert.match(begin,/if \(!latestBilling\)/);
  assert.match(begin,/if \(latestBilling\.hasStripeSubscription\)/);
  assert.ok(begin.indexOf('getMyBillingState(targetSiteId)') < begin.indexOf('startPlanCheckout(targetSiteId, planKey, billingCycle)'));
});

test('subscription checkout blocks duplicate subscriptions in pending or failed states',()=>{
  assert.match(checkout,/!\["canceled", "incomplete_expired"\]\.includes\(current\.status\)/);
  assert.ok(checkout.indexOf('code: "existing_subscription"') < checkout.indexOf('createStripeSubscriptionCheckout({'));
});

test('subscription Stripe Checkout carries stable idempotency per client attempt',()=>{
  const stripe=fs.readFileSync(new URL('../lib/stripe-billing.ts',import.meta.url),'utf8');
  const billing=fs.readFileSync(new URL('../lib/billing-access.ts',import.meta.url),'utf8');
  assert.match(stripe,/Idempotency-Key/);
  assert.match(stripe,/subscriptionCheckoutIdempotencyKey/);
  assert.match(stripe,/idempotencyKey: subscriptionCheckoutIdempotencyKey/);
  assert.match(billing,/pendingSubscriptionAttempts\.get\(intent\)/);
  assert.match(billing,/if \(pending\) return pending/);
  assert.match(billing,/\.finally\(\(\) =>/);
  assert.match(billing,/checkoutAttemptId/);
  assert.match(checkout,/code: "checkout_attempt_required"/);
  assert.match(checkout,/attemptId: checkoutAttemptId/);
});

test('subscription checkout attempt requires a structured UUID, not merely 36 allowed characters',()=>{
  assert.match(checkout,/\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[1-8\]\[0-9a-f\]\{3\}-\[89ab\]\[0-9a-f\]\{3\}-\[0-9a-f\]\{12\}/);
  assert.doesNotMatch(checkout,/\^\[a-f0-9-\]\{36\}\$/);
});

test('changing selected website synchronizes the site id used for billing',()=>{
  const plans=fs.readFileSync(new URL('../app/plans/page.tsx',import.meta.url),'utf8');
  assert.match(plans,/setSiteId\(site\?\.id \|\| ""\)/);
  assert.doesNotMatch(plans,/if \(site && !siteId\) setSiteId/);
  assert.match(plans,/selectedSiteRef\.current = event\.target\.value; setLoaded\(false\); setBillingState\(null\)/);
});

test('plans ignores responses from stale multi-site asynchronous loads',()=>{
  const plans=fs.readFileSync(new URL('../app/plans/page.tsx',import.meta.url),'utf8');
  assert.match(plans,/const loadSequence = useRef\(0\)/);
  assert.match(plans,/const sequence = \+\+loadSequence\.current/);
  assert.equal((plans.match(/if \(sequence !== loadSequence\.current\) return;/g)||[]).length,2);
});

test('plans blocks checkout while switching websites or billing is unresolved',()=>{
  const plans=fs.readFileSync(new URL('../app/plans/page.tsx',import.meta.url),'utf8');
  assert.match(plans,/if \(!siteId \|\| !loaded \|\| !billingState \|\| betaAccess\.active \|\| paymentInProgressRef\.current\) return/);
  assert.match(plans,/selectedSiteRef\.current = event\.target\.value; setLoaded\(false\); setBillingState\(null\)/);
  assert.match(plans,/Impossible de charger ce site/);
});

test('plans pins billing requests to selected site and blocks concurrent switches',()=>{
  const plans=fs.readFileSync(new URL('../app/plans/page.tsx',import.meta.url),'utf8');
  assert.match(plans,/const targetSiteId = siteId/);
  assert.match(plans,/if \(selectedSiteRef\.current !== targetSiteId\) \{/);
  assert.match(plans,/await startPlanCheckout\(targetSiteId, planKey, billingCycle\)/);
  assert.match(plans,/await openStripeBillingPortal\(targetSiteId\)/);
  assert.match(plans,/paymentInProgressRef\.current = false/);
});

test('AI Launch checkout shares the multi-site in-flight payment lock',()=>{
  const plans=fs.readFileSync(new URL('../app/plans/page.tsx',import.meta.url),'utf8');
  const start=plans.indexOf('async function buyAiLaunch()');
  const end=plans.indexOf('const betaExpiryLabel',start);
  const body=plans.slice(start,end);
  assert.match(body,/paymentInProgressRef\.current/);
  assert.match(body,/const targetSiteId = siteId/);
  assert.match(body,/await startAiLaunchCheckout\(targetSiteId\)/);
  assert.match(body,/finally \{/);
});

test('stale site early exit clears both payment loading indicators',()=>{
  const plans=fs.readFileSync(new URL('../app/plans/page.tsx',import.meta.url),'utf8');
  const condition='if (selectedSiteRef.current !== targetSiteId) {\n        setCheckoutBusy("");\n        return;\n      }';
  assert.equal(plans.split(condition).length-1,2);
});

test('client and server agree which Stripe statuses require the existing-account portal',()=>{
  const billing=fs.readFileSync(new URL('../lib/billing-access.ts',import.meta.url),'utf8');
  const statuses='!["canceled", "incomplete_expired"].includes(subscription?.status || "")';
  assert.equal(billing.split(statuses).length-1,2);
  assert.ok(checkout.includes('!["canceled", "incomplete_expired"].includes(current.status)'));
});
