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
Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'service', CRON_SECRET: 'cron-test' });
test('monitor invokes only the deterministic RPC and contains backend failures', async () => {
  for (const fail of [false, true]) {
    const names = [];
    const module = load('../lib/ai-finops-monitor.ts', { '@supabase/supabase-js': { createClient: () => ({ rpc: async name => {
      names.push(name);
      if (fail) throw Error('secret');
      return { data: { ok: true, activeAlerts: 3 }, error: null };
    } }) } });
    assert.deepEqual(await module.runAiFinopsMonitorSafely(), fail ? { ok: false } : { ok: true, activeAlerts: 3 });
    assert.deepEqual(names, ['run_ai_finops_monitor']);
  }
});
test('both scheduled jobs deny bad authentication before monitoring', async () => {
  for (const path of ['../app/api/cron/storage-backup/route.ts', '../app/api/cron/billing-notifications/route.ts']) {
    let monitored = 0;
    let supportReconciled = 0;
    const route = load(path, {
      'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
      '../../../../lib/storage-backup': { runStorageBackup: async () => { throw Error('should not run'); } },
      '../../../../lib/app-url': { appBaseUrl: () => 'https://builder.example' },
      '../../../../lib/ai-finops-monitor': { runAiFinopsMonitorSafely: async () => { monitored++; return { ok: true }; } },
      '../../../../lib/support-reconcile': { runSupportReconciliationSafely: async () => { supportReconciled++; return { ok: true }; } }
    });
    for (const headers of [{}, { authorization: 'Bearer wrong' }]) {
      const response = await route.GET(new Request('https://builder.example/api/cron/job', { headers }));
      assert.equal(response.status, 401);
    }
    assert.equal(monitored, 0);
    assert.equal(supportReconciled, 0);
  }
});
test('monitor failures do not skip the backup and cannot masquerade as cron success', async () => {
  let backups = 0;
  const route = load('../app/api/cron/storage-backup/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '../../../../lib/storage-backup': { runStorageBackup: async () => { backups++; return { ok: true, configured: true }; } },
    '../../../../lib/ai-finops-monitor': { runAiFinopsMonitorSafely: async () => ({ ok: false }) },
    '../../../../lib/support-reconcile': { runSupportReconciliationSafely: async () => ({ ok: true, scanned: 0 }) }
  });
  const response = await route.GET(new Request('https://builder.example/api/cron/storage-backup', { headers: { authorization: 'Bearer cron-test' } }));
  assert.equal(backups, 1);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).finops.ok, false);
});

test('support reconciliation failures do not skip the backup and are visible to cron monitoring', async () => {
  let backups = 0;
  const route = load('../app/api/cron/storage-backup/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '../../../../lib/storage-backup': { runStorageBackup: async () => { backups++; return { ok: true, configured: true }; } },
    '../../../../lib/ai-finops-monitor': { runAiFinopsMonitorSafely: async () => ({ ok: true }) },
    '../../../../lib/support-reconcile': { runSupportReconciliationSafely: async () => ({ ok: false, scanned: 1, failed: 1 }) }
  });
  const response = await route.GET(new Request('https://builder.example/api/cron/storage-backup', { headers: { authorization: 'Bearer cron-test' } }));
  const body = await response.json();
  assert.equal(backups, 1);
  assert.equal(response.status, 503);
  assert.equal(body.support.ok, false);
});
