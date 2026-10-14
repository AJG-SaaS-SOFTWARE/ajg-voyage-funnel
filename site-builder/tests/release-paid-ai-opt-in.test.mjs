import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const workflow = fs.readFileSync(new URL("../../.github/workflows/site-builder-production.yml", import.meta.url), "utf8");

test("production release requires a manual explicit opt-in for the paid AI recipe", () => {
  assert.match(workflow, /run_paid_ai_e2e:[\s\S]*?type: boolean[\s\S]*?default: false/);
  const step = workflow.split("- name: Run full AI FR/EN release E2E for deployed SHA")[1].split("- name:")[0];
  assert.match(step, /if: github\.event_name == 'workflow_dispatch' && inputs\.run_paid_ai_e2e == true/);
  assert.match(step, /\/api\/cron\/release-e2e/);
  assert.match(workflow, /Run structural FR\/EN release E2E for deployed SHA/);
});

test("provider billing recipe success requires invoice footer and cleanup evidence", () => {
  const step = workflow.split("- name: Run provider-backed Stripe lifecycle E2E when configured")[1].split("- name:")[0];
  assert.match(step, /payload\?\.invoiceFooterValidated !== true/);
  assert.match(step, /payload\?\.cleanupOk !== true/);
});
