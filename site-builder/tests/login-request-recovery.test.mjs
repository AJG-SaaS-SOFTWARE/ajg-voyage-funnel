import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../app/login/page.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX
} }).outputText;

function fixture(send, locale = 'fr') {
  const slots = []; let cursor = 0; const requests = [];
  const element = (type, props) => ({ type, props });
  const dependencies = {
    'react/jsx-runtime': { jsx: element, jsxs: element },
    react: {
      useEffect() {},
      useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial;
        return [slots[index], value => { slots[index] = value; }]; },
      useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial };
        return slots[index]; }
    },
    'next/link': { default: 'a' },
    'next/navigation': { useRouter: () => ({ replace() { throw new Error('unexpected redirect'); } }) },
    '../../lib/supabase-browser': { isSupabaseConfigured: () => true,
      getSupabaseBrowserClient: () => ({ auth: { async signInWithOtp(input) {
        requests.push(input); return send(input);
      } } }) },
    '../../lib/product-i18n': { useProductLocale: () => ({ locale, tr: (fr, en) => locale === 'en' ? en : fr }) },
    '../../components/LanguageSwitch': { LanguageSwitch: 'language-switch' },
    '../../components/EltaraBrand': { EltaraBrand: 'brand' },
    '../../lib/private-beta-access': { getPrivateBetaAccess() { throw new Error('unexpected access lookup'); } }
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'window', code)(name => {
    assert.ok(name in dependencies, name); return dependencies[name];
  }, module, module.exports, { location: { origin: 'https://eltara.example' } });
  function render() { cursor = 0; return module.exports.default(); }
  function find(node, predicate) {
    if (!node || typeof node !== 'object') return undefined;
    if (predicate(node)) return node;
    const children = [node.props?.children].flat(Infinity);
    for (const child of children) { const result = find(child, predicate); if (result) return result; }
  }
  function byType(type) { return find(render(), node => node.type === type); }
  function enter(email) { byType('input').props.onChange({ target: { value: email } }); }
  function submit() { return byType('form').props.onSubmit({ preventDefault() {} }); }
  return { requests, render, find, byType, enter, submit };
}

test('network rejection releases the login form without exposing provider details', async () => {
  for (const locale of ['fr', 'en']) {
    const f = fixture(async () => { throw new Error('private-provider-marker'); }, locale);
    f.enter('invited@example.invalid');
    await assert.doesNotReject(f.submit());
    assert.equal(f.byType('button').props.disabled, false);
    assert.equal(f.requests.length, 1);
    const output = JSON.stringify(f.render());
    assert.equal(output.includes('private-provider-marker'), false);
    assert.match(output, locale === 'fr' ? /envoi.*confirmé/ : /confirm.*sent/);
  }
});

test('a simultaneous second submit cannot send a second magic link', async () => {
  let complete; const deferred = new Promise(resolve => { complete = resolve; });
  const f = fixture(() => deferred); f.enter('invited@example.invalid');
  const first = f.submit(); const second = f.submit();
  assert.equal(f.requests.length, 1);
  complete({ error: null }); await Promise.all([first, second]);
  assert.equal(f.byType('form'), undefined);
});

test('a rejected provider response leaves the form available and a later manual retry can succeed', async () => {
  let attempt = 0;
  const f = fixture(async () => ++attempt === 1 ? { error: { message: 'private-provider-marker' } } : { error: null }, 'en');
  f.enter('  invited@example.invalid  '); await f.submit();
  assert.equal(f.byType('button').props.disabled, false);
  assert.equal(JSON.stringify(f.render()).includes('private-provider-marker'), false);
  await f.submit();
  assert.equal(f.byType('form'), undefined);
  assert.deepEqual(f.requests, Array(2).fill({ email: 'invited@example.invalid', options: {
    emailRedirectTo: 'https://eltara.example/builder?lang=en', shouldCreateUser: false
  } }));
});
