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
const reportLib = load('../lib/ai-finops-report.ts');
const report = {
  month: '2026-09', currency: 'USD', totalCostMicros: 0, calls: 0, uncertainCalls: 0, legacyUnlinkedCalls: 0,
  policy: { ai_enabled: true, heavy_enabled: true, global_daily_micros: 20_000_000, global_monthly_micros: 100_000_000 },
  budgetExposure: { dayMicros: 0, monthMicros: 0 }
};
test('months are UTC validated, reject impossible dates and future months', () => {
  const now = new Date('2026-09-30T23:45:00Z');
  assert.equal(reportLib.finopsMonth(null, now), '2026-09');
  assert.equal(reportLib.finopsMonth('2026-08', now), '2026-08');
  for (const value of ['', '2026-13', '2026-00', '2026-10', '2026-09-01', 'x']) assert.throws(() => reportLib.finopsMonth(value, now));
});
test('unmeasured cost is distinct from measured zero', () => {
  assert.equal(reportLib.usdCost(null), 'Non mesuré');
  assert.notEqual(reportLib.usdCost(0), 'Non mesuré');
  assert.match(reportLib.usdCost(1_234_567), /1,2346/);
});
test('global alerts use live exposure including prior-period provisions and highest threshold only', () => {
  for (const [ratio, level] of [[.49, null], [.5, 'info'], [.75, 'warning'], [.9, 'critical'], [1.01, 'critical']]) {
    const sample = { ...report, month: '2026-08', budgetExposure: { dayMicros: 0, monthMicros: ratio * 100_000_000 } };
    const alerts = reportLib.finopsAlerts(sample);
    assert.equal(alerts.length, level ? 1 : 0);
    if (level) assert.equal(alerts[0].level, level);
  }
  const zero = reportLib.finopsAlerts({ ...report, policy: { ...report.policy, global_daily_micros: 0 } });
  assert.equal(zero[0].level, 'critical');
});
test('uncertain costs and legacy calls cannot masquerade as measured complete generations', () => {
  const alerts = reportLib.finopsAlerts({ ...report, uncertainCalls: 2, legacyUnlinkedCalls: 3, policy: { ...report.policy, heavy_enabled: false } });
  assert.deepEqual(alerts.map(a => a.key), ['heavy-paused', 'uncertain', 'legacy']);
});

function harness({ role = 'admin', authenticated = true, rpcError = null, payload = report, throws = false } = {}) {
  const calls = [];
  const createClient = (url, key) => {
    calls.push(['client', key]);
    if (key === 'service') return {
      rpc: async (name, args) => {
        calls.push(['rpc', name, args]);
        if (throws) throw Error('secret backend error');
        if (name === 'get_ai_finops_monitor_status') return { data: { items: [], activeAlerts: 0, lastRunAt: null }, error: null };
        return { data: payload, error: rpcError };
      },
      from: (table) => ({
        select() { return this; },
        gte() { return this; },
        order() { return this; },
        async limit(value) {
          calls.push(['query', table, value]);
          return { data: [], error: null };
        }
      })
    };
    return { auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'user' } : null }, error: null }) }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role }, error: null }) }) }) }) };
  };
  const route = load('../app/api/admin/ai-finops/route.ts', {
    '@supabase/supabase-js': { createClient },
    '../../../../lib/ai-finops-report': reportLib,
    '../../../../lib/ai-usage-anomaly': {
      detectAiUsageAnomaly: () => ({
        status: 'healthy', checked: true, windowMinutes: 60, baselineDays: 7,
        currentCalls: 0, baselineCallsPerHour: 0, currentCostMicros: 0,
        baselineCostMicrosPerHour: 0, callRatio: 0, costRatio: 0, truncated: false
      }),
      aiUsageAnomalyMessage: () => null
    },
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } }
  });
  return { route, calls };
}
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'public';
process.env.SUPABASE_SECRET_KEY = 'service';
const request = (suffix = '', token = 'valid') => new Request('https://builder.example/api/admin/ai-finops' + suffix, { headers: token ? { authorization: 'Bearer ' + token } : {} });
test('missing/invalid identity and non-admin are rejected before service-role access', async () => {
  for (const [options, token, status] of [[{}, '', 401], [{ authenticated: false }, 'invalid', 401], [{ role: 'customer' }, 'valid', 403]]) {
    const h = harness(options);
    const response = await h.route.GET(request('', token));
    assert.equal(response.status, status);
    assert.ok(!h.calls.some(c => c[0] === 'client' && c[1] === 'service'));
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
});
test('invalid month does not run report and backend failures reveal no secret', async () => {
  const h = harness();
  assert.equal((await h.route.GET(request('?month=2026-13'))).status, 400);
  assert.ok(!h.calls.some(c => c[0] === 'rpc'));
  for (const options of [{ rpcError: { message: 'secret' } }, { throws: true }, { payload: { ...report, currency: 'EUR' } }]) {
    const response = await harness(options).route.GET(request('?month=2026-09'));
    assert.equal(response.status, 503);
    assert.ok(!(await response.text()).includes('secret'));
  }
});
test('admin receives complete SQL aggregate and alerts without browser caching', async () => {
  const h = harness();
  const response = await h.route.GET(request('?month=2026-09'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(h.calls.find(c => c[0] === 'rpc'), ['rpc', 'ai_finops_monthly_report', { p_month: '2026-09-01' }]);
  assert.deepEqual((await response.json()).report, report);
});
