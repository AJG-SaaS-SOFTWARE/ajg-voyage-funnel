import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL("../lib/billing-guidance.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/billing/page.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const module = { exports: {} };
new Function("require", "module", "exports", code)(require, module, module.exports);
const { billingGuide, billingStateLabel } = module.exports;

const base = {
  state: "active", paidThrough: null, graceUntil: null, restrictedAt: null,
  publicSuspendAt: null, exportUntil: null, deleteAfter: null, providerStatus: null,
  provider: "stripe", hasBillingAccount: true
};

test("active billing state is readable and keeps management optional", () => {
  assert.equal(billingStateLabel("active", "fr"), "Actif");
  const steps = billingGuide(base);
  assert.deepEqual(steps.map(step => step.status), ["done", "optional", "optional"]);
});

test("failed payment makes payment restoration the current action", () => {
  const steps = billingGuide({ ...base, state: "grace", hasBillingAccount: true });
  assert.deepEqual(steps.map(step => step.status), ["current", "current", "waiting"]);
  assert.match(steps[1].detailFr, /Stripe/);
  assert.match(steps[1].detailFr, /serveur/);
});

test("site without Stripe account is directed to the plan page", () => {
  const steps = billingGuide({ ...base, state: "restricted", hasBillingAccount: false });
  assert.equal(steps[1].href, "/plans");
});

test("retention phase prioritizes export rather than promising payment recovery", () => {
  const steps = billingGuide({ ...base, state: "retention" });
  assert.equal(steps[2].status, "current");
  assert.match(steps[2].detailFr, /archive complète/);
});

test("billing page states that browser actions do not directly change entitlements", () => {
  assert.match(page, /Les changements d’accès restent confirmés côté serveur/);
  assert.match(page, /Access changes remain confirmed server-side/);
});
