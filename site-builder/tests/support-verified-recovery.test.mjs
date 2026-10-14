import test from "node:test";
import assert from "node:assert/strict";
import { supportCustomerAction, supportReconcileDecision } from "../lib/support-reconcile-policy.ts";

const check = (key, status, clientAction) => ({ key, status, clientAction });
const healthy = [check("backend","healthy"),check("public_render","healthy"),check("domain","healthy")];
const input = { overall:"healthy",clientAction:null,ageHours:1,category:"domain",
  previousDiagnosis:{checks:[check("domain","action","Corrigez les DNS")]},checks:healthy };

test("a supported domain cause can resolve only after a fresh public-render check", () => {
  assert.equal(supportReconcileDecision(input).resolved,true);
  for (const checks of [[],healthy.filter(c=>c.key!=="public_render"),
    healthy.map(c=>c.key==="public_render"?{...c,status:"action"}:c),
    [...healthy,check("domain","incident")]]) {
    assert.equal(supportReconcileDecision({...input,checks}).resolved,false);
  }
});
test("healthy infrastructure never auto-closes bugs, quality complaints, data requests or billing disputes", () => {
  for (const category of ["bug","ai","data","other","billing","unknown"]) {
    assert.equal(supportReconcileDecision({...input,category}).resolved,false);
  }
});
test("missing or unrelated original evidence cannot manufacture a recovered cause", () => {
  for (const previousDiagnosis of [null,{},[],{checks:[]},{checks:[check("domain","healthy")]},
    {checks:[check("billing","action")]},{checks:[null,42,{}]}]) {
    assert.equal(supportReconcileDecision({...input,previousDiagnosis}).resolved,false);
  }
});
test("a new incident always escalates even when the original cause appears recovered", () => {
  const decision=supportReconcileDecision({...input,overall:"incident"});
  assert.equal(decision.resolved,false);assert.equal(decision.severity,"high");
});
test("self-service guidance follows the ticket category instead of an unrelated general warning", () => {
  const checks=[check("billing","action","Régularisez"),check("domain","action","Corrigez DNS")];
  assert.equal(supportCustomerAction("domain",checks),"Corrigez DNS");
  assert.equal(supportCustomerAction("billing",checks),"Régularisez");
  for (const category of ["bug","data","other","ai"]) assert.equal(supportCustomerAction(category,checks),null);
});
