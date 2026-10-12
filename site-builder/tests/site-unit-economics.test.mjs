import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const code = ts.transpileModule(fs.readFileSync(new URL('../lib/site-unit-economics.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const moduleRef = { exports: {} };
new Function('require', 'module', 'exports', code)(require, moduleRef, moduleRef.exports);
const { calculateSiteMonthEconomics } = moduleRef.exports;
const base = {
  revenueExVatCents: 1500, paymentFeesCents: 48, hostingCents: 75,
  storageCents: 15, bandwidthCents: 10, backupsCents: 20, mediaCents: 0,
  emailCents: 0, domainCents: 0, observabilityCents: 0, otherCents: 0,
  aiUsdMicros: 1_000_000, aiUncertainUsdMicros: 0
};
const fx = { usdToEur: 0.9, effectiveDate: '2026-10-12', source: 'test-fixture' };
test('costs are attributed with explicit FX and VAT-exclusive revenue', () => {
  const x = calculateSiteMonthEconomics(base, fx);
  assert.equal(x.aiCostCents, 90);
  assert.equal(x.costCents, 258);
  assert.equal(x.contributionCents, 1242);
  assert.equal(x.meets80PercentTarget, true);
});
test('uncertain supplier costs remain provisioned rather than treated as zero', () => {
  const x = calculateSiteMonthEconomics({ ...base, aiUncertainUsdMicros: 2_000_000 }, fx);
  assert.equal(x.unresolvedAiProvisionCents, 180);
  assert.equal(x.costCents, 438);
  assert.equal(x.meets80PercentTarget, false);
});
test('zero-revenue sites are visible rather than reporting a fake margin', () => {
  const x = calculateSiteMonthEconomics({ ...base, revenueExVatCents: 0 }, fx);
  assert.equal(x.marginPercent, null);
  assert.equal(x.status, 'no_revenue');
});
test('refuses absent exchange evidence, negative and fractional costs', () => {
  assert.throws(() => calculateSiteMonthEconomics(base, { ...fx, source: '' }), /invalid_fx_rate/);
  assert.throws(() => calculateSiteMonthEconomics({ ...base, hostingCents: -1 }, fx), /invalid_hostingCents/);
  assert.throws(() => calculateSiteMonthEconomics({ ...base, paymentFeesCents: 3.4 }, fx), /invalid_paymentFeesCents/);
  assert.throws(() => calculateSiteMonthEconomics({ ...base, aiUsdMicros: -1 }, fx), /invalid_usd_micros/);
});
