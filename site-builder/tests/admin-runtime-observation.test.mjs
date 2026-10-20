import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

function load(path, dependencies = {}) {
  const code = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(name => {
    assert.ok(name in dependencies, name);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}

const observation = load("../lib/admin-runtime-observation.ts");
const healthy = { checked: true, status: "healthy", truncated: false, errorCount: 0, fatalCount: 0, http5xxCount: 0, lookbackMinutes: 60, sampledLogs: 0, deploymentId: "dpl_synthetic" };
const probe = { host: "synthetic.invalid", dns: "ok", https: "ok", httpStatus: 200 };

test("only an explicitly checked, complete healthy runtime can confirm healthy", () => {
  assert.equal(observation.adminRuntimeObservation(healthy), "healthy");
  for (const value of [null, undefined, {}, { ...healthy, status: "unknown" }, { ...healthy, status: "unexpected" }]) {
    assert.equal(observation.adminRuntimeObservation(value), "unknown");
  }
});

test("unchecked or uncertain flags cannot confirm absence of errors", () => {
  for (const checked of [undefined, null, false, 0, 1, "true"]) {
    for (const status of ["healthy", "warning", "incident", "unknown"]) {
      assert.equal(observation.adminRuntimeObservation({ ...healthy, checked, status }), "unknown");
    }
  }
  for (const truncated of [undefined, null, true, 0, "false"]) {
    assert.equal(observation.adminRuntimeObservation({ ...healthy, truncated }), "unknown");
  }
});

test("observed warnings and incidents remain visible even in a partial sample", () => {
  for (const status of ["warning", "incident"]) {
    for (const truncated of [false, true]) {
      assert.equal(observation.adminRuntimeObservation({ ...healthy, status, truncated }), status);
    }
  }
});

test("classifying evidence does not rewrite source status, counts or metadata", () => {
  const source = { ...healthy, truncated: true, unavailableReason: "synthetic-marker" };
  const before = structuredClone(source);
  assert.equal(observation.adminRuntimeObservation(source), "unknown");
  assert.deepEqual(source, before);
});

async function adminGet(runtime, app = probe, external = probe) {
  const keys = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"];
  const saved = keys.map(key => process.env[key]);
  keys.forEach(key => { process.env[key] = "synthetic-test"; });
  try {
    let queries = 0;
    let probes = 0;
    let reads = 0;
    const queue = [{ id: "synthetic-ticket" }];
    const userClient = {
      auth: { getUser: async () => ({ data: { user: { id: "synthetic-admin" } }, error: null }) },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: "admin" }, error: null }) }) }) })
    };
    const service = { from() {
      const data = queries++ === 0 ? queue : [];
      const builder = {
        select() { return builder; }, gte() { return builder; }, eq() { return builder; }, order() { return builder; },
        limit() { return Promise.resolve({ data, error: null, count: 0 }); }
      };
      return builder;
    } };
    let clients = 0;
    const route = load("../app/api/admin/support/route.ts", {
      "next/server": { NextResponse: { json: (body, options) => Response.json(body, options) } },
      "@supabase/supabase-js": { createClient: () => ++clients === 1 ? userClient : service },
      "../../../../lib/support-events": {},
      "../../../../lib/support-metrics": load("../lib/support-metrics.ts"),
      "../../../../lib/admin-platform-probe": { platformProbe: async () => ++probes === 1 ? app : external },
      "../../../../lib/vercel-runtime-health": { getRecentRuntimeHealth: async () => { reads++; return runtime; } },
      "../../../../lib/admin-runtime-observation": observation
    });
    const denied = await route.GET(new Request("https://synthetic.invalid/api/admin/support"));
    assert.equal(denied.status, 401);
    assert.deepEqual([queries, probes, reads], [0, 0, 0]);
    const response = await route.GET(new Request("https://synthetic.invalid/api/admin/support", { headers: { authorization: "Bearer synthetic-token" } }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const body = await response.json();
    assert.deepEqual(body.tickets, queue);
    assert.equal(body.metricsStatus, "complete");
    assert.deepEqual(body.platform.runtime, JSON.parse(JSON.stringify(runtime)));
    assert.deepEqual([queries, probes, reads], [5, 3, 1]);
    return body.platform;
  } finally {
    keys.forEach((key, index) => {
      if (saved[index] === undefined) delete process.env[key]; else process.env[key] = saved[index];
    });
  }
}

test("the real admin GET cannot turn unknown, unchecked or partial runtime into global healthy", async () => {
  for (const runtime of [{ ...healthy, checked: false, status: "unknown" }, { ...healthy, checked: false }, { ...healthy, truncated: true }, { ...healthy, truncated: undefined }, { ...healthy, status: "unexpected" }]) {
    const platform = await adminGet(runtime);
    assert.equal(platform.overall, "warning");
    assert.match(platform.nextAction, /observation runtime est indisponible ou incomplète/);
    assert.match(platform.nextAction, /ne confirme pas une panne/);
  }
  const platform = await adminGet(healthy);
  assert.equal(platform.overall, "healthy");
  assert.equal(platform.nextAction, null);
});

test("the real admin GET preserves observed severity and independent platform failures", async () => {
  for (const status of ["warning", "incident"]) {
    const platform = await adminGet({ ...healthy, status, truncated: true, errorCount: 5 });
    assert.equal(platform.overall, status);
    assert.doesNotMatch(platform.nextAction, /ne confirme pas une panne/);
  }
  const unknown = { ...healthy, status: "unknown", checked: false };
  const appFailure = await adminGet(unknown, { ...probe, https: "unavailable", httpStatus: 503 });
  assert.equal(appFailure.overall, "incident");
  assert.match(appFailure.nextAction, /secours Vercel/);
  const dnsFailure = await adminGet(unknown, probe, { ...probe, dns: "nxdomain", https: "skipped", httpStatus: null });
  assert.equal(dnsFailure.overall, "warning");
  assert.match(dnsFailure.nextAction, /DNS externe/);
});

function renderRuntime(platform) {
  const states = [[], null, "unavailable", platform, null, false, "ready", ""];
  let stateIndex = 0;
  const page = load("../app/admin/support/page.tsx", {
    "react": { ...React, useState: () => [states[stateIndex++], () => {}], useEffect: () => {} },
    "react/jsx-runtime": jsxRuntime,
    "../../../components/AdminShell": { AdminShell: ({ children }) => React.createElement("main", null, children) },
    "../../../lib/supabase-browser": { getSupabaseBrowserClient: () => { throw Error("no auth/network in render fixture"); } },
    "../../../lib/admin-runtime-observation": observation
  }).default;
  const html = renderToStaticMarkup(React.createElement(page));
  assert.equal(stateIndex, states.length);
  return html;
}

test("the actual admin page does not print a healthy zero for unknown or incomplete evidence", () => {
  for (const runtime of [{ ...healthy, status: "unknown", checked: false }, { ...healthy, checked: false }, { ...healthy, truncated: true }]) {
    const html = renderRuntime({ overall: "warning", app: probe, publicDomain: probe, managedDomainCanary: probe, runtime, nextAction: null });
    assert.match(html, /<b>—<\/b><span>runtime · erreurs\/5xx/);
    assert.doesNotMatch(html, /<b>0<\/b><span>runtime · erreurs\/5xx/);
  }
});

test("the actual admin page retains confirmed zero and visible partial error counts", () => {
  for (const [runtime, display] of [[healthy, "0"], [{ ...healthy, status: "warning", truncated: true, errorCount: 1, http5xxCount: 2 }, "3"], [{ ...healthy, status: "incident", truncated: true, errorCount: 5 }, "5"]]) {
    const html = renderRuntime({ overall: runtime.status, app: probe, publicDomain: probe, managedDomainCanary: probe, runtime, nextAction: null });
    assert.match(html, new RegExp(`<b>${display}</b><span>runtime · erreurs/5xx`));
  }
});
