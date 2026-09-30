import test from "node:test";
import assert from "node:assert/strict";
import { supportReconcileDecision } from "../lib/support-reconcile-policy.ts";

test("waiting customer ticket auto-resolves only after its diagnosed cause disappears", () => {
  assert.deepEqual(
    supportReconcileDecision({
      overall: "healthy",
      clientAction: null,
      ageHours: 12
    }),
    {
      status: "resolved",
      resolutionCode: "auto_health_recovered",
      resolved: true
    }
  );
});

test("a newly detected infrastructure incident escalates immediately to AJG", () => {
  assert.deepEqual(
    supportReconcileDecision({
      overall: "incident",
      clientAction: null,
      ageHours: 1
    }),
    {
      status: "diagnosed",
      severity: "high",
      resolutionCode: null,
      resolved: false
    }
  );
});

test("a valid customer action remains self-service before the escalation deadline", () => {
  assert.equal(
    supportReconcileDecision({
      overall: "action",
      clientAction: "Corrigez votre DNS.",
      ageHours: 24
    }).status,
    "waiting_customer"
  );
});

test("unresolved customer action escalates after 72 hours instead of remaining stuck", () => {
  const decision = supportReconcileDecision({
    overall: "action",
    clientAction: "Corrigez votre DNS.",
    ageHours: 72
  });
  assert.equal(decision.status, "diagnosed");
  assert.equal(decision.resolved, false);
});

test("an action state without any customer action escalates instead of being stranded", () => {
  assert.equal(
    supportReconcileDecision({
      overall: "action",
      clientAction: null,
      ageHours: 2
    }).status,
    "diagnosed"
  );
});
