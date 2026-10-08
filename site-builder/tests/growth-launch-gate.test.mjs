import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
function load(path, overrides = {}) {
  const code = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => overrides[name] || require(name), module, module.exports);
  return module.exports;
}
test('annual launch benefit is disabled unless explicitly enabled', () => {
  const { growthAnnualIncludesLaunch } = load('../lib/growth-launch-offer.ts');
  const old = process.env.AJG_GROWTH_ANNUAL_INCLUDES_AI_LAUNCH;
  try {
    for (const value of ['', 'false', '1', 'yes']) { process.env.AJG_GROWTH_ANNUAL_INCLUDES_AI_LAUNCH = value; assert.equal(growthAnnualIncludesLaunch(), false); }
    process.env.AJG_GROWTH_ANNUAL_INCLUDES_AI_LAUNCH = ' true ';
    assert.equal(growthAnnualIncludesLaunch(), true);
  } finally { if (old === undefined) delete process.env.AJG_GROWTH_ANNUAL_INCLUDES_AI_LAUNCH; else process.env.AJG_GROWTH_ANNUAL_INCLUDES_AI_LAUNCH = old; }
});
test('public pricing renders the actual enabled offer in both languages', () => {
  const { PricingPage } = load('../components/PricingPage.tsx', { 'next/link': { default: props => React.createElement('a', props, props.children) }, './PricingPage.module.css': { default: {} } });
  for (const locale of ['fr', 'en']) {
    const disabled = renderToStaticMarkup(React.createElement(PricingPage, { locale, annualIncludesLaunch: false }));
    const enabled = renderToStaticMarkup(React.createElement(PricingPage, { locale, annualIncludesLaunch: true }));
    assert.ok(disabled.includes(locale === 'fr' ? 'Création IA disponible séparément' : 'AI Launch available separately'));
    assert.ok(!disabled.includes(locale === 'fr' ? 'incluse avec Growth annuel' : 'included with annual Growth'));
    assert.ok(enabled.includes(locale === 'fr' ? 'incluse avec Growth annuel' : 'included with annual Growth'));
  }
});
test('annual Growth AI grant is applied only from the paid invoice path', () => {
  const webhook = fs.readFileSync(new URL('../app/api/billing/stripe-webhook/route.ts', import.meta.url), 'utf8');
  assert.equal((webhook.match(/source: "growth_annual"/g) || []).length, 1);
  assert.ok(webhook.includes('const paid = event.type === "invoice.paid"'));
  assert.ok(webhook.includes('paid &&\n    growthAnnualIncludesLaunch()'));
});
