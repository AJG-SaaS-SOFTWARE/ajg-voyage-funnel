import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
function load(path, overrides = {}) {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => overrides[name] || require(name), module, module.exports);
  return module.exports;
}
const cost = load('../lib/ai-cost.ts');
const { AiBudgetError, providerCostCeiling, createBudgetedProviderFetch } = load('../lib/ai-provider-budget.ts', { './ai-cost': cost });
const body = JSON.stringify({ model: 'gpt-5.6-luna', input: 'Écrire un titre', max_output_tokens: 140 });
function harness(admission = 'ok', settlementError = null) {
  const calls = [];
  return { calls, service: { async rpc(name, args) { calls.push({ name, args }); return { data: name.startsWith('reserve') ? admission : true, error: name.startsWith('settle') ? settlementError : null }; } } };
}
const context = service => ({ service, userId: 'user', siteId: 'site', requestId: 'root', planKey: 'essential', pool: 'run', operation: 'heroTitle' });
test('ceiling accounts for UTF8 and framing, refuses unknown models and Premium field routing', () => {
  assert.ok(providerCostCeiling(body, false).micros > 0);
  assert.throws(() => providerCostCeiling(JSON.stringify({ model: 'unknown', max_output_tokens: 100 }), true), /unpriced_model/);
  assert.throws(() => providerCostCeiling(JSON.stringify({ model: 'gpt-5.6', max_output_tokens: 100 }), false), /standard_model_not_allowed/);
  assert.throws(() => providerCostCeiling(JSON.stringify({ model: 'gpt-5.6', max_output_tokens: 3001 }), true), /invalid_output_limit/);
  assert.throws(() => providerCostCeiling(JSON.stringify({ model: 'gpt-5.6', input: 'x'.repeat(100000), max_output_tokens: 100 }), true), /provider_context_too_large/);
});
test('admission failure prevents provider invocation', async () => {
  const h = harness('global_monthly_budget_limit'); let spent = 0;
  const fetcher = createBudgetedProviderFetch(context(h.service), async () => { spent++; });
  await assert.rejects(fetcher('https://api.openai.com/v1/responses', { body }), /global_monthly_budget_limit/);
  assert.equal(spent, 0); assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].name, 'reserve_ai_provider_budget_with_model');
  assert.equal(h.calls[0].args.p_model, 'gpt-5.6-luna');
});
test('success settles actual tokens and preserves response for the writer', async () => {
  const h = harness();
  const data = { model: 'gpt-5.6-luna', usage: { input_tokens: 100, output_tokens: 20 }, output_text: 'Titre' };
  const fetcher = createBudgetedProviderFetch(context(h.service), async () => Response.json(data));
  const response = await fetcher('https://api.openai.com/v1/responses', { body });
  assert.deepEqual(await response.json(), data);
  assert.equal(h.calls[1].args.p_cost_micros, 44);
  assert.equal(h.calls[1].args.p_state, 'settled');
});
test('network uncertainty conserves monetary reservation instead of erasing possible spend', async () => {
  const h = harness();
  const fetcher = createBudgetedProviderFetch(context(h.service), async () => { throw new Error('timeout'); });
  await assert.rejects(fetcher('https://api.openai.com/v1/responses', { body }), /timeout/);
  assert.equal(h.calls[1].args.p_cost_micros, null);
  assert.equal(h.calls[1].args.p_state, 'uncertain');
});
test('provider rejection releases monetary capacity; malformed success conserves it', async () => {
  for (const status of [429, 200, 503]) {
    const h = harness();
    const fetcher = createBudgetedProviderFetch(context(h.service), async () => Response.json({}, { status }));
    await fetcher('https://api.openai.com/v1/responses', { body });
    assert.equal(h.calls[1].args.p_state, status === 429 ? 'settled' : 'uncertain');
    assert.equal(h.calls[1].args.p_cost_micros, status === 429 ? 0 : null);
  }
});
test('settlement failure never returns a successful AI result', async () => {
  const h = harness('ok', { message: 'DB unavailable' });
  const fetcher = createBudgetedProviderFetch(context(h.service), async () => Response.json({ usage: { input_tokens: 10, output_tokens: 10 } }));
  await assert.rejects(fetcher('https://api.openai.com/v1/responses', { body }), /budget_settlement_unavailable/);
});
test('writer refunds standard quota only when no usable result is returned', async () => {
  const oldEnv = { ...process.env };
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable-test', SUPABASE_SECRET_KEY: 'secret-test', OPENAI_API_KEY: 'provider-test' });
  try {
    for (const scenario of ['success', 'empty', 'network', 'budget', 'duplicate']) {
      const calls = [];
      const client = {
        auth: { async getUser() { return { data: { user: { id: 'user' } }, error: null }; } },
        async rpc(name, args) {
          calls.push(name);
          if (name === 'get_my_site_capabilities') return { data: { can_generate_ai: true } };
          if (name === 'admit_ai_request' && scenario === 'duplicate') return { data: 'duplicate_request' };
          if (name === 'get_my_site_entitlements') return { data: { plan_key: 'essential' } };
          if (name === 'reserve_ai_provider_budget_with_model' && scenario === 'budget') return { data: 'monthly_budget_limit' };
          return { data: name === 'settle_ai_provider_budget' ? true : 'ok', error: null };
        },
        from() { return { async insert() { return { error: null }; } }; }
      };
      const provider = async () => {
        if (scenario === 'network') throw new Error('network failure');
        return Response.json({ model: 'gpt-5.6-luna', usage: { input_tokens: 100, output_tokens: 20 }, output_text: scenario === 'empty' ? '' : 'A clear title' });
      };
      const route = load('../app/api/ai/write/route.ts', {
        'next/server': { NextResponse: { json: (data, init) => Response.json(data, init) } },
        '@supabase/supabase-js': { createClient: () => client },
        '../../../../lib/ai-cost': cost,
        '../../../../lib/ai-request-admission': load('../lib/ai-request-admission.ts'),
        '../../../../lib/ai-provider-budget': { AiBudgetError, createBudgetedProviderFetch: ctx => createBudgetedProviderFetch(ctx, provider) },
        '../../../../lib/premium-site-architect': { PremiumArchitectError: class extends Error {} },
        '../../../../lib/server-locale': { requestProductLocale: () => 'en', localize: (_, fr, en) => en },
        '../../../../lib/openai-readiness': { isOpenAiUnavailableError: (code, status) => ['expired_secret_key', 'invalid_api_key', 'credit_balance_exhausted', 'insufficient_quota'].includes(code) || status === 401 || status === 403 },
        '../../../../lib/standard-ai-writer': {
          selectStandardContextEntries: (_, entries) => entries,
          standardStructuredFormat: () => null,
          sanitizeStandardText: text => text,
          standardQualityIssues: () => []
        }
      });
      const response = await route.POST(new Request('http://localhost/api/ai/write', { method: 'POST', headers: { authorization: 'Bearer test', 'content-type': 'application/json' }, body: JSON.stringify({ siteId: 'site', field: 'heroTitle', instruction: 'Write a title' }) }));
      assert.equal(response.status, scenario === 'success' ? 200 : scenario === 'empty' ? 502 : scenario === 'network' ? 503 : scenario === 'duplicate' ? 409 : 429);
      assert.equal(calls.includes('release_my_site_ai_generation'), scenario !== 'success' && scenario !== 'duplicate', scenario);
      assert.equal(calls.includes('reserve_ai_provider_budget_with_model'), scenario !== 'duplicate');
    }
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in oldEnv)) delete process.env[key];
    Object.assign(process.env, oldEnv);
  }
});


test('Premium Architect worst-case correction path is allowed through provider call sequence 7', () => {
  const migration = fs.readFileSync(
    new URL('../supabase/migrations/20261008084200_ai_provider_budget_sequence_7.sql', import.meta.url),
    'utf8'
  );
  assert.match(migration, /sequence between 1 and 7/);
  assert.match(migration, /p_sequence not between 1 and 7/);
  assert.doesNotMatch(migration, /global_daily_micros\s*=|global_monthly_micros\s*=/);
});
