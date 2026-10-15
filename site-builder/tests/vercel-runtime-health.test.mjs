import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL("../lib/vercel-runtime-health.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const module = { exports: {} };
new Function("require", "module", "exports", code)(require, module, module.exports);
const { summarizeRuntimeRows, getRecentRuntimeHealth } = module.exports;

test("runtime health stays healthy without recent errors", () => {
  const now = Date.now();
  const result = summarizeRuntimeRows([
    { level: "info", timestampInMs: now - 2_000, responseStatusCode: 200 },
    { level: "warning", timestampInMs: now - 3_000, responseStatusCode: 429 }
  ], now);
  assert.equal(result.status, "healthy");
  assert.equal(result.errorCount, 0);
  assert.equal(result.http5xxCount, 0);
});

test("runtime health warns on isolated recent errors without exposing messages", () => {
  const now = Date.now();
  const result = summarizeRuntimeRows([
    { level: "error", timestampInMs: now - 1_000, responseStatusCode: 500 }
  ], now);
  assert.equal(result.status, "warning");
  assert.equal(result.errorCount, 1);
  assert.equal(result.http5xxCount, 1);
  assert.equal("message" in result, false);
});

test("runtime health escalates repeated failures or fatal events", () => {
  const now = Date.now();
  const repeated = Array.from({ length: 5 }, (_, index) => ({
    level: "error",
    timestampInMs: now - index * 1_000,
    responseStatusCode: 500
  }));
  assert.equal(summarizeRuntimeRows(repeated, now).status, "incident");
  assert.equal(summarizeRuntimeRows([{ level: "fatal", timestampInMs: now, responseStatusCode: 500 }], now).status, "incident");
});

test("runtime health ignores rows outside the one-hour window", () => {
  const now = Date.now();
  const result = summarizeRuntimeRows([
    { level: "fatal", timestampInMs: now - 2 * 60 * 60 * 1_000, responseStatusCode: 500 }
  ], now);
  assert.equal(result.status, "healthy");
  assert.equal(result.sampledLogs, 0);
});


async function withRuntimeEnvironment(run) {
  const names = ["VERCEL_TOKEN", "VERCEL_PROJECT_ID", "VERCEL_TEAM_ID", "VERCEL_ORG_ID", "VERCEL_DEPLOYMENT_ID"];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  Object.assign(process.env, { VERCEL_TOKEN: "synthetic-not-a-secret", VERCEL_PROJECT_ID: "prj_fixture", VERCEL_TEAM_ID: "team_fixture", VERCEL_DEPLOYMENT_ID: "dpl_fixture" });
  try { await run(); } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
}

test("runtime HTTP refusals remain unknown with a safe diagnostic", async t => {
  await withRuntimeEnvironment(async () => {
    t.mock.method(globalThis, "fetch", async () => new Response("private provider detail", { status: 403 }));
    const result = await getRecentRuntimeHealth();
    assert.equal(result.checked, false);
    assert.equal(result.status, "unknown");
    assert.equal(result.unavailableReason, "runtime_http_403");
    assert.equal(result.deploymentId, "dpl_fixture");
    assert.doesNotMatch(JSON.stringify(result), /private provider detail|synthetic-not-a-secret/);
  });
});

test("runtime configuration failure precedes provider access", async t => {
  await withRuntimeEnvironment(async () => {
    delete process.env.VERCEL_TOKEN;
    const mock = t.mock.method(globalThis, "fetch", async () => { throw new Error("must not call"); });
    const result = await getRecentRuntimeHealth();
    assert.equal(result.unavailableReason, "runtime_not_configured");
    assert.equal(result.status, "unknown");
    assert.equal(mock.mock.callCount(), 0);
  });
});

test("runtime transport failure never exposes raw provider errors", async t => {
  await withRuntimeEnvironment(async () => {
    t.mock.method(globalThis, "fetch", async () => { throw new Error("private token and provider URL"); });
    const result = await getRecentRuntimeHealth();
    assert.equal(result.unavailableReason, "runtime_response_unavailable");
    assert.equal(result.checked, false);
    assert.doesNotMatch(JSON.stringify(result), /private token|provider URL/);
  });
});

test("complete runtime response preserves checked evidence", async t => {
  await withRuntimeEnvironment(async () => {
    t.mock.method(globalThis, "fetch", async () => Response.json({rows: [{timestamp: new Date().toISOString(), statusCode: 500, logs: [{level: "error", message: "private"}]}], hasMoreRows: false}));
    const result = await getRecentRuntimeHealth();
    assert.equal(result.checked, true);
    assert.equal(result.status, "warning");
    assert.equal(result.errorCount, 1);
    assert.equal(result.unavailableReason, undefined);
  });
});


test("historical query is finite, deployment scoped and bounded to the last hour", async t => {
  await withRuntimeEnvironment(async () => {
    t.mock.method(globalThis, "fetch", async (url) => {
      const request = new URL(url);
      assert.equal(request.origin, "https://vercel.com");
      assert.equal(request.pathname, "/api/logs/request-logs");
      assert.equal(request.searchParams.get("deploymentId"), "dpl_fixture");
      assert.equal(request.searchParams.get("environment"), "production");
      assert.equal(Number(request.searchParams.get("endDate")) - Number(request.searchParams.get("startDate")), 3600000);
      return Response.json({rows: [], hasMoreRows: false});
    });
    const result = await getRecentRuntimeHealth();
    assert.equal(result.checked, true);
    assert.equal(result.status, "healthy");
    assert.equal(result.truncated, false);
  });
});

test("historical pagination remains incomplete evidence", async t => {
  await withRuntimeEnvironment(async () => {
    t.mock.method(globalThis, "fetch", async () => Response.json({rows: [], hasMoreRows: true}));
    const result = await getRecentRuntimeHealth();
    assert.equal(result.truncated, true);
  });
});

test("invalid historical evidence cannot masquerade as an empty healthy window", async t => {
  await withRuntimeEnvironment(async () => {
    let payload;
    t.mock.method(globalThis, "fetch", async () => Response.json(payload));
    for (payload of [{}, {rows: []}, {rows: [{timestamp: "bad", statusCode: 500}], hasMoreRows: false},
      {rows: [{timestamp: new Date().toISOString(), statusCode: 500, logs: [{level: "invalid"}]}], hasMoreRows: false}]) {
      const result = await getRecentRuntimeHealth();
      assert.equal(result.checked, false);
      assert.equal(result.status, "unknown");
    }
  });
});

test("oversized historical responses remain unavailable", async t => {
  await withRuntimeEnvironment(async () => {
    t.mock.method(globalThis, "fetch", async () => new Response("x".repeat(128 * 1024 + 1)));
    const result = await getRecentRuntimeHealth();
    assert.equal(result.unavailableReason, "runtime_response_too_large");
    assert.equal(result.checked, false);
  });
});
