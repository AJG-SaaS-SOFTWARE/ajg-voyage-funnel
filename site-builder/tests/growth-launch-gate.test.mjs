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
test('the validated annual offer includes BUILD without depending on the obsolete profitability flag', () => {
  const { growthAnnualIncludesLaunch } = load('../lib/growth-launch-offer.ts');
  const old = process.env.AJG_GROWTH_ANNUAL_INCLUDES_AI_LAUNCH;
  try {
    for (const value of ['', 'false', '1', 'yes']) { process.env.AJG_GROWTH_ANNUAL_INCLUDES_AI_LAUNCH = value; assert.equal(growthAnnualIncludesLaunch(), true); }
    process.env.AJG_GROWTH_ANNUAL_INCLUDES_AI_LAUNCH = ' true ';
    assert.equal(growthAnnualIncludesLaunch(), true);
  } finally { if (old === undefined) delete process.env.AJG_GROWTH_ANNUAL_INCLUDES_AI_LAUNCH; else process.env.AJG_GROWTH_ANNUAL_INCLUDES_AI_LAUNCH = old; }
});
test('annual BUILD reference is stable within a paid period and changes on renewal', () => {
  const { growthAnnualLaunchReference } = load('../lib/growth-launch-offer.ts');
  const first = growthAnnualLaunchReference('site','sub','2027-10-13T00:00:00Z');
  assert.equal(first,growthAnnualLaunchReference('site','sub','2027-10-13T00:00:00.000Z'));
  assert.notEqual(first,growthAnnualLaunchReference('site','sub','2028-10-13T00:00:00Z'));
  assert.throws(()=>growthAnnualLaunchReference('site','sub','invalid'),/invalid_annual_build_period/);
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

