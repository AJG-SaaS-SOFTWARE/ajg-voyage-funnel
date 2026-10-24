import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const now = Date.parse("2026-10-24T10:00:00Z");
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return now; }
}
const healthy = {
  status: "healthy", completed_at: "2026-10-24T07:05:03Z", repair_failures: 0,
  active_tester_count: 0, follow_up_candidates: 0, awaiting_resume: 0,
  unresponsive_after_followup: 0, completed_missions: 0
};
function compile(path) {
  return ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
}
async function report(patch = {}, { missing = false, queryError = false } = {}) {
  const queries = [];
  const service = { from(table) {
    const query = {
      select(columns) { queries.push({ table, columns }); return query; },
      eq() { return query; }, gte() { return query; }, order() { return query; }, limit() { return query; },
      async maybeSingle() {
        if (table === "beta_operations_runs") return { data: missing ? null : { ...healthy, ...patch }, error: queryError ? { message: "private-db-marker" } : null };
        assert.equal(table, "support_operations_runs");
        return { data: { status: "healthy", completed_at: "2026-10-24T09:20:00Z", runtime_status: "healthy" }, error: null };
      },
      then(resolve, reject) { return Promise.resolve({ data: [], count: 0, error: null }).then(resolve, reject); }
    };
    return query;
  } };
  const dependencies = {
    "server-only": {},
    "./cockpit-reporting-auth": { authorizedReportingRequest: () => false },
    "./server-billing": { billingServiceClient: () => service },
    "./commercial-checkout-readiness": {
      commercialCheckoutReadiness: async () => ({ ok: true, reasons: [], stripeAudit: [{ ok: true }] }),
      commercialConfigurationReadiness: () => ({ legal: { ok: true }, tax: { ok: true }, stripe: { ok: true } })
    },
    "./openai-readiness": { auditOpenAiRuntimeCached: async () => ({ status: "healthy" }) },
    "./release-e2e-policy": { releaseE2ERunDecision: () => ({ reason: "already_validated" }) }
  };
  for (const name of ["support-agent-status", "beta-agent-evidence"]) {
    const path = new URL(`../lib/${name}.ts`, import.meta.url);
    if (!fs.existsSync(path)) continue;
    const module = { exports: {} };
    new Function("module", "exports", "Date", compile(`../lib/${name}.ts`))(module, module.exports, Clock);
    dependencies[`./${name}`] = module.exports;
  }
  const module = { exports: {} };
  new Function("require", "module", "exports", "Date", "process", compile("../lib/business-reporting.ts"))(
    name => { assert.ok(name in dependencies, name); return dependencies[name]; }, module, module.exports, Clock,
    { env: { AJG_RELEASE_SHA: "a".repeat(40), STRIPE_RESTRICTED_KEY: "rk_test_synthetic" } }
  );
  const result = await module.exports.buildBuilderBusinessReport();
  for (const { columns } of queries) assert.doesNotMatch(columns, /\*|owner_id|user_id|email|site_id/);
  assert.equal(JSON.stringify(result).includes("private-db-marker"), false);
  return result;
}

test("a fresh completed beta run with consistent zero failures can support healthy reporting", async () => {
  const r = await report();
  assert.equal(r.betaOperations.status, "healthy");
  assert.equal(r.status, "healthy");
});

test("running, unknown and uncompleted beta journals cannot silently report healthy", async () => {
  for (const patch of [{ status: "running", completed_at: null }, { status: "unexpected" }, { completed_at: null }]) {
    const r = await report(patch);
    assert.equal(r.betaOperations.status, "attention");
    assert.equal(r.status, "warning");
    assert.doesNotMatch(r.detail, /0 relance\(s\)/);
  }
});

test("stale, invalid and future completion cannot prove the daily beta agent is running", async () => {
  for (const completed_at of ["2026-10-22T21:59:59Z", "invalid", "", "2026-10-24T10:00:01Z"]) {
    const r = await report({ completed_at });
    assert.equal(r.betaOperations.status, "attention");
    assert.equal(r.status, "warning");
    assert.doesNotMatch(r.detail, /0 relance\(s\)/);
  }
  const boundary = await report({ completed_at: "2026-10-22T22:00:00Z" });
  assert.equal(boundary.betaOperations.status, "healthy");
});

test("contradictory or malformed beta work counters cannot certify health", async () => {
  for (const patch of [
    { repair_failures: 1 }, { repair_failures: null }, { repair_failures: -1 },
    { repair_failures: "0" }, { repair_failures: 0.5 },
    { follow_up_candidates: 1 }, { unresponsive_after_followup: 1 },
    { follow_up_candidates: NaN }, { unresponsive_after_followup: null }
  ]) {
    const r = await report(patch);
    assert.equal(r.betaOperations.status, "attention");
    assert.equal(r.status, "warning");
  }
});

test("a recorded technical failure remains failed even when its journal is old", async () => {
  const r = await report({ status: "failed", completed_at: "2026-10-20T07:00:00Z" });
  assert.equal(r.betaOperations.status, "failed");
  assert.equal(r.status, "critical");
});

test("missing or unavailable beta evidence remains unavailable with no invented healthy result", async () => {
  for (const options of [{ missing: true }, { queryError: true }]) {
    const r = await report({}, options);
    assert.equal(r.betaOperations.status, "unavailable");
    assert.equal(r.status, "warning");
    assert.equal(r.betaOperations.checkedAt, null);
  }
});

test("a positive follow-up state is distinct from incomplete execution evidence", async () => {
  const r = await report({ status: "attention", follow_up_candidates: 2 });
  assert.equal(r.betaOperations.status, "attention");
  assert.equal(r.status, "warning");
  assert.match(r.detail, /2 relance\(s\) Beta Tester/);
});
