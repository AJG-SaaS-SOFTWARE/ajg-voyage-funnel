import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const source = fs.readFileSync(
  new URL("../lib/support-metrics.ts", import.meta.url),
  "utf8"
);
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;
const module = { exports: {} };
new Function("require", "module", "exports", code)(
  require,
  module,
  module.exports
);
const { calculateSupportMetrics } = module.exports;

test("support KPI counts unique escalated and human-touched tickets", () => {
  const metrics = calculateSupportMetrics({
    tickets: [
      { id: "a", category: "domain", status: "resolved", resolution_code: "auto_health_recovered", created_at: "2026-10-01T00:00:00Z" },
      { id: "b", category: "billing", status: "resolved", resolution_code: null, created_at: "2026-10-01T00:00:00Z" },
      { id: "c", category: "domain", status: "diagnosed", resolution_code: null, created_at: "2026-10-01T00:00:00Z" }
    ],
    events: [
      { ticket_id: "a", actor_type: "system", event_type: "resolution", metadata: { status: "resolved" }, created_at: "2026-10-01T01:00:00Z" },
      { ticket_id: "b", actor_type: "admin", event_type: "resolution", metadata: { status: "resolved" }, created_at: "2026-10-01T01:00:00Z" },
      { ticket_id: "c", actor_type: "client", event_type: "created", metadata: { status: "diagnosed" }, created_at: "2026-10-01T01:00:00Z" },
      { ticket_id: "c", actor_type: "system", event_type: "diagnostic", metadata: { status: "diagnosed" }, created_at: "2026-10-01T02:00:00Z" }
    ],
    remediations: [],
    sites: [{ owner_id: "u1" }, { owner_id: "u2" }, { owner_id: "u2" }]
  });

  assert.equal(metrics.activeClients, 2);
  assert.equal(metrics.escalatedTickets, 1);
  assert.equal(metrics.adminTouchedTickets, 1);
  assert.equal(metrics.autoResolvedTickets, 1);
  assert.equal(metrics.selfServiceResolvedTickets, 1);
  assert.equal(metrics.escalatedPerActiveClient, 0.5);
  assert.equal(metrics.adminTouchedPerActiveClient, 0.5);
  assert.equal(metrics.selfServiceResolutionRate, 1 / 3);
});

test("support KPI aggregates remediation outcomes and recurring codes", () => {
  const metrics = calculateSupportMetrics({
    tickets: [],
    events: [],
    sites: [],
    remediations: [
      { status: "succeeded", result_code: "managed_domain_verified", trigger_source: "system", created_at: "2026-10-01T00:00:00Z" },
      { status: "succeeded", result_code: "managed_domain_verified", trigger_source: "client", created_at: "2026-10-01T00:00:00Z" },
      { status: "failed", result_code: "managed_domain_still_pending", trigger_source: "system", created_at: "2026-10-01T00:00:00Z" },
      { status: "no_change", result_code: "managed_domain_already_healthy", trigger_source: "client", created_at: "2026-10-01T00:00:00Z" }
    ]
  });

  assert.equal(metrics.remediation.attempted, 4);
  assert.equal(metrics.remediation.succeeded, 2);
  assert.equal(metrics.remediation.failed, 1);
  assert.equal(metrics.remediation.noChange, 1);
  assert.equal(metrics.remediation.successRate, 0.5);
  assert.deepEqual(metrics.remediation.byCode[0], {
    code: "managed_domain_verified",
    count: 2
  });
});

test("support KPI returns zero rates when no active clients or tickets exist", () => {
  const metrics = calculateSupportMetrics({
    tickets: [],
    events: [],
    remediations: [],
    sites: []
  });
  assert.equal(metrics.escalatedPerActiveClient, 0);
  assert.equal(metrics.adminTouchedPerActiveClient, 0);
  assert.equal(metrics.selfServiceResolutionRate, 0);
  assert.equal(metrics.remediation.successRate, 0);
});

const at = "2026-10-20T07:00:00Z";
const ticket = (id, status = "open", resolution_code = null) => ({ id, status, resolution_code, category: "domain", created_at: at });
const resolution = (ticket_id, actor_type = "system") => ({ ticket_id, actor_type, event_type: "resolution", metadata: { status: "resolved" }, created_at: at });
const calculate = (tickets, events) => calculateSupportMetrics({ tickets, events, remediations: [], sites: [] });

test("resolution events for older tickets cannot inflate the created-ticket cohort above 100 percent", () => {
  const metrics = calculate([ticket("new", "resolved")], [resolution("new"), resolution("older-a"), resolution("older-b")]);
  assert.equal(metrics.ticketsCreated, 1);
  assert.equal(metrics.selfServiceResolvedTickets, 1);
  assert.equal(metrics.selfServiceResolutionRate, 1);
  // Activity counters keep their existing window-wide meaning; do not hide
  // work on older tickets to repair the cohort-based ratio.
  assert.equal(metrics.autoResolvedTickets, 3);
});

test("an old-ticket resolution cannot turn an unrelated new open ticket into a self-service success", () => {
  const metrics = calculate([ticket("new")], [resolution("older")]);
  assert.equal(metrics.selfServiceResolvedTickets, 0);
  assert.equal(metrics.selfServiceResolutionRate, 0);
});

test("events alone do not invent a created-ticket cohort", () => {
  const metrics = calculate([], [resolution("older")]);
  assert.equal(metrics.ticketsCreated, 0);
  assert.equal(metrics.selfServiceResolvedTickets, 0);
  assert.equal(metrics.selfServiceResolutionRate, 0);
});

test("reopened or non-terminal tickets are not current self-service resolutions", () => {
  for (const status of ["open", "diagnosed", "in_progress", "waiting_customer"]) {
    const metrics = calculate([ticket("reopened", status)], [resolution("reopened")]);
    assert.equal(metrics.selfServiceResolvedTickets, 0, status);
    assert.equal(metrics.selfServiceResolutionRate, 0, status);
    assert.equal(metrics.autoResolvedTickets, 1);
  }
});

test("an old automatic resolution code does not override a non-terminal ticket state", () => {
  const metrics = calculate([ticket("reopened", "open", "auto_health_recovered")], []);
  assert.equal(metrics.selfServiceResolvedTickets, 0);
  assert.equal(metrics.selfServiceResolutionRate, 0);
});

test("current resolved and closed cohort members still count without a redundant resolution event", () => {
  const metrics = calculate([ticket("resolved", "resolved"), ticket("closed", "closed"), ticket("open")], []);
  assert.equal(metrics.selfServiceResolvedTickets, 2);
  assert.equal(metrics.selfServiceResolutionRate, 2 / 3);
});

test("an admin-touched terminal ticket remains excluded regardless of event ordering or duplication", () => {
  const events = [resolution("a"), resolution("a", "admin"), resolution("a"), resolution("older")];
  for (const ordered of [events, [...events].reverse()]) {
    const metrics = calculate([ticket("a", "resolved")], ordered);
    assert.equal(metrics.selfServiceResolvedTickets, 0);
    assert.equal(metrics.selfServiceResolutionRate, 0);
    assert.equal(metrics.adminTouchedTickets, 1);
  }
});

test("self-service cohort is stable under duplicate and unrelated events without clamping the result", () => {
  const tickets = [ticket("a", "resolved"), ticket("b", "closed"), ticket("c", "open")];
  for (let older = 0; older < 12; older++) {
    const events = [resolution("a"), resolution("a"), resolution("c"), ...Array.from({ length: older }, (_, i) => resolution(`older-${i}`))];
    const before = structuredClone({ tickets, events });
    const metrics = calculate(tickets, events);
    assert.equal(metrics.selfServiceResolvedTickets, 2);
    assert.equal(metrics.selfServiceResolutionRate, 2 / 3);
    assert.deepEqual({ tickets, events }, before);
  }
});
