import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL('../lib/stripe-billing.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled)(require, module, module.exports);
const { subscriptionCheckoutIdempotencyKey, stripeRequest, createStripeSubscriptionCheckout } = module.exports;

test('Stripe subscription retry uses the same derived key', () => {
  const input = {siteId: 'site-123', ownerId: 'owner-456', priceId: 'price_789', attemptId: '8d65b4d8-2a46-4b72-a4c3-d9c2119b2281'};
  const key = subscriptionCheckoutIdempotencyKey(input);
  assert.match(key, /^[a-f0-9]{64}$/);
  assert.equal(key, subscriptionCheckoutIdempotencyKey({...input}));
  for (const field of ['siteId', 'ownerId', 'priceId', 'attemptId']) {
    assert.notEqual(key, subscriptionCheckoutIdempotencyKey({...input, [field]: input[field]+'X'}));
  }
  assert.throws(() => subscriptionCheckoutIdempotencyKey({...input, ownerId:''}), /invalid_checkout_idempotency/);
});

test('Stripe emits Idempotency-Key only for POST requests that specify it', async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.STRIPE_SECRET_KEY;
  const oldRestrictedKey = process.env.STRIPE_RESTRICTED_KEY;
  const seen = [];
  process.env.STRIPE_RESTRICTED_KEY = '';
  process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
  globalThis.fetch = async (_url, init) => {
    seen.push(init);
    return {ok:true,json:async()=>({id:'cs_test_dummy'})};
  };
  try {
    await stripeRequest('/checkout/sessions', {idempotencyKey:'retry-key',params:{mode:'subscription'}});
    await stripeRequest('/prices/price_test', {method:'GET',idempotencyKey:'should-not-send'});
    assert.equal(seen[0].headers['Idempotency-Key'], 'retry-key');
    assert.equal(seen[1].headers['Idempotency-Key'], undefined);
    assert.equal(seen[0].headers['Stripe-Version'], '2026-08-26.dahlia');
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = oldKey;
    if (oldRestrictedKey === undefined) delete process.env.STRIPE_RESTRICTED_KEY;
    else process.env.STRIPE_RESTRICTED_KEY = oldRestrictedKey;
  }
});

test('two retries of one subscription attempt send identical Checkout payloads and idempotency headers', async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.STRIPE_SECRET_KEY;
  const previousRestricted = process.env.STRIPE_RESTRICTED_KEY;
  const seen = [];
  process.env.STRIPE_RESTRICTED_KEY = '';
  process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
  globalThis.fetch = async (_url, init) => {
    seen.push({body: init.body, key: init.headers['Idempotency-Key']});
    return {ok:true, json:async()=>({id:'cs_test_one',url:'https://checkout.stripe.com/test'})};
  };
  const checkout = {
    siteId:'site-1', ownerId:'owner-1', ownerEmail:'test@example.com',
    customerId:null, priceId:'price_test_essential', planKey:'essential',
    successUrl:'https://example.org/success',cancelUrl:'https://example.org/cancel',
    attemptId:'8d65b4d8-2a46-4b72-a4c3-d9c2119b2281'
  };
  try {
    await createStripeSubscriptionCheckout(checkout);
    await createStripeSubscriptionCheckout({...checkout});
    assert.equal(seen.length,2);
    assert.equal(seen[0].key,seen[1].key);
    assert.equal(seen[0].body,seen[1].body);
    await createStripeSubscriptionCheckout({...checkout,attemptId:'8d65b4d8-2a46-4b72-a4c3-d9c2119b2282'});
    assert.notEqual(seen[0].key,seen[2].key);
    assert.notEqual(seen[0].body,seen[2].body);
  } finally {
    globalThis.fetch = previousFetch;
    if(previousKey===undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY=previousKey;
    if(previousRestricted===undefined) delete process.env.STRIPE_RESTRICTED_KEY;
    else process.env.STRIPE_RESTRICTED_KEY=previousRestricted;
  }
});
