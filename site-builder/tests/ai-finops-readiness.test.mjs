import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/ai-finops-readiness.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const module = { exports: {} };
new Function("require", "module", "exports", code)(() => ({}), module, module.exports);
const { aiFinopsPolicyReadiness, aiFinopsMonitorReadiness } = module.exports;

const route = fs.readFileSync(
  new URL("../app/api/admin/release-readiness/route.ts", import.meta.url),
  "utf8"
);

test("AI FinOps policy blocks missing ceilings and active breakers", () => {
  assert.equal(
    aiFinopsPolicyReadiness({
      aiEnabled: true,
      heavyEnabled: true,
      globalDailyMicros: 0,
      globalMonthlyMicros: 100_000_000
    }).status,
    "blocker"
  );
  assert.equal(
    aiFinopsPolicyReadiness({
      aiEnabled: false,
      heavyEnabled: true,
      globalDailyMicros: 20_000_000,
      globalMonthlyMicros: 100_000_000
    }).status,
    "blocker"
  );
  assert.equal(
    aiFinopsPolicyReadiness({
      aiEnabled: true,
      heavyEnabled: true,
      globalDailyMicros: 20_000_000,
      globalMonthlyMicros: 100_000_000
    }).status,
    "pass"
  );
});

test("AI FinOps monitor freshness is pass warn then blocker", () => {
  const now = Date.parse("2026-10-07T12:00:00Z");

  assert.equal(
    aiFinopsMonitorReadiness(
      { lastRunAt: "2026-10-07T08:00:00Z", activeAlerts: 0 },
      now
    ).status,
    "pass"
  );
  assert.equal(
    aiFinopsMonitorReadiness(
      { lastRunAt: "2026-10-06T08:00:00Z", activeAlerts: 1 },
      now
    ).status,
    "warn"
  );
  assert.equal(
    aiFinopsMonitorReadiness(
      { lastRunAt: "2026-10-05T08:00:00Z", activeAlerts: 0 },
      now
    ).status,
    "blocker"
  );
  assert.equal(
    aiFinopsMonitorReadiness({ lastRunAt: null, activeAlerts: 0 }, now).status,
    "blocker"
  );
});

test("recent active budget alerts remain visible without disabling the monitor", () => {
  const result = aiFinopsMonitorReadiness(
    { lastRunAt: "2026-10-07T11:00:00Z", activeAlerts: 2 },
    Date.parse("2026-10-07T12:00:00Z")
  );
  assert.equal(result.status, "warn");
  assert.match(result.detail, /2 alerte/);
});

test("release readiness reads service-only FinOps state without mutating budgets", () => {
  assert.match(route, /\.from\("ai_cost_policy"\)/);
  assert.match(route, /\.from\("ai_finops_monitor_state"\)/);
  assert.match(route, /key: "ai-finops-policy"/);
  assert.match(route, /key: "ai-finops-monitor"/);
  assert.match(route, /aiFinopsPolicyReadiness/);
  assert.match(route, /aiFinopsMonitorReadiness/);
  assert.doesNotMatch(route, /\.from\("ai_cost_policy"\)[\s\S]{0,300}\.update\(/);
});
