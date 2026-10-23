import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../app/admin/finops/page.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText;

const deferred = () => {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
};
const flush = async () => { for (let index = 0; index < 20; index += 1) await Promise.resolve(); };

function fixture(readReport) {
  const state = [];
  const effects = [];
  const timers = [];
  const cleared = [];
  const signals = [];
  let cursor = 0;
  let nextTimerId = 0;
  let reads = 0;
  const element = (type, props) => ({ type, props });
  const dependencies = {
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in state)) state[index] = initial;
        return [state[index], value => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
      },
      useEffect(effect) { effects.push(effect); }
    },
    "react/jsx-runtime": { Fragment: "fragment", jsx: element, jsxs: element },
    "../../../components/AdminShell": { AdminShell: "admin-shell" },
    "../../../lib/admin": {
      getAdminAiFinops(month, signal) {
        reads += 1;
        signals.push(signal);
        return readReport(reads, month, signal);
      }
    },
    "../../../lib/ai-finops-report": {
      usdCost: value => String(value ?? "unknown"),
      finopsMonitorLabel: value => value
    },
    "../../../lib/ai-usage-anomaly": {}
  };
  const fakeWindow = {
    setTimeout(callback, delay) {
      const id = ++nextTimerId;
      timers.push({ id, callback, delay });
      return id;
    },
    clearTimeout(id) { cleared.push(id); }
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", "window", "AbortController", code)(name => {
    assert.ok(name in dependencies, name);
    return dependencies[name];
  }, module, module.exports, fakeWindow, AbortController);
  function render() {
    cursor = 0;
    effects.length = 0;
    return module.exports.default();
  }
  return { cleared, effects, render, signals, state, timers, reads: () => reads };
}

function find(node, predicate) {
  if (!node || typeof node !== "object") return null;
  if (predicate(node)) return node;
  for (const value of Object.values(node.props || {})) {
    for (const child of Array.isArray(value) ? value : [value]) {
      const found = find(child, predicate);
      if (found) return found;
    }
  }
  return null;
}

const completeReport = {
  report: {
    month: "2026-10",
    totalCostMicros: 0,
    calls: 0,
    uncertainCalls: 0,
    policy: { ai_enabled: false, heavy_enabled: false, global_daily_micros: 0, global_monthly_micros: 0 },
    budgetExposure: { dayMicros: 0, monthMicros: 0 },
    launchRights: { completedRights: 0, measuredRights: 0, meanToDateMicros: 0, p95ToDateMicros: 0, meanCompletedMicros: 0 },
    requests: [],
    planAccounts: [],
    dimensions: {}
  },
  alerts: [],
  monitor: null,
  anomaly: { status: "healthy", baselineDays: 7, currentCalls: 0, baselineCallsPerHour: 0, currentCostMicros: 0, baselineCostMicrosPerHour: 0 },
  generatedAt: "2026-10-23T00:00:00.000Z"
};

test("a stalled FinOps read becomes recoverable without displaying partial financial data", async () => {
  const stalled = deferred();
  const page = fixture(() => stalled.promise);
  page.render();
  const cleanup = page.effects[0]();
  await flush();
  assert.equal(page.timers.length, 1);
  assert.equal(page.timers[0].delay, 15_000);

  page.timers[0].callback();
  await flush();
  assert.equal(page.state[3], false);
  assert.match(page.state[2], /n’a pas pu être lu de façon fiable/);
  assert.equal(page.state[1], null);
  assert.equal(page.signals[0].aborted, true);

  stalled.resolve(completeReport);
  await flush();
  assert.equal(page.state[1], null, "a late report cannot replace the recoverable failure state");
  assert.deepEqual(page.cleared, [page.timers[0].id]);
  cleanup();
});

test("the read-only refresh recovers a complete report and supersedes the stalled read", async () => {
  const stalled = deferred();
  const page = fixture(read => read === 1 ? stalled.promise : Promise.resolve(completeReport));
  let tree = page.render();
  const firstCleanup = page.effects[0]();
  page.timers[0].callback();
  await flush();

  tree = page.render();
  const refresh = find(tree, node => node.type === "button" && node.props?.children === "Actualiser");
  assert.ok(refresh);
  assert.equal(refresh.props.disabled, false);
  refresh.props.onClick();
  firstCleanup();

  page.render();
  const secondCleanup = page.effects[0]();
  await flush();
  assert.equal(page.reads(), 2);
  assert.equal(page.state[3], false);
  assert.equal(page.state[2], "");
  assert.deepEqual(page.state[1], completeReport);

  stalled.resolve({ ...completeReport, generatedAt: "2026-10-22T00:00:00.000Z" });
  await flush();
  assert.deepEqual(page.state[1], completeReport, "the superseded read cannot replace the recovered report");
  secondCleanup();
});
