import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const code = ts.transpileModule(fs.readFileSync(new URL('../lib/ai-request-admission.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const module = { exports: {} };
new Function('require','module','exports',code)(require,module,module.exports);
const { aiRequestHashes } = module.exports;
test('semantic deduplication ignores object key order while binding owner and site', () => {
  const a = aiRequestHashes({ instruction:'A', context:{ language:'en', brand:'B' } },'user','site',null,'secret');
  const b = aiRequestHashes({ context:{ brand:'B', language:'en' },instruction:'A' },'user','site',null,'secret');
  assert.deepEqual(a,b);
  assert.equal(a.fingerprint.length,64);
  assert.equal(a.keyHash,null);
  assert.notEqual(a.fingerprint,aiRequestHashes({instruction:'A'},'other','site',null,'secret').fingerprint);
  assert.notEqual(a.fingerprint,aiRequestHashes({instruction:'A'},'user','other',null,'secret').fingerprint);
});
test('explicit idempotency key is stable within a user and independent of payload', () => {
  const a=aiRequestHashes({instruction:'A'},'user','site','key','secret');
  const b=aiRequestHashes({instruction:'B'},'user','site','key','secret');
  assert.equal(a.keyHash,b.keyHash);
  assert.notEqual(a.fingerprint,b.fingerprint);
  assert.notEqual(a.keyHash,aiRequestHashes({},'other','site','key','secret').keyHash);
  assert.throws(()=>aiRequestHashes({},'user','site',' ', 'secret'),/invalid_idempotency_key/);
  assert.throws(()=>aiRequestHashes({},'user','site','a'.repeat(129),'secret'),/invalid_idempotency_key/);
});
