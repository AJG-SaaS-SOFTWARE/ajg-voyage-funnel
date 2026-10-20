import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";

function load(path, dependencies = {}) {
  const code = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(name => {
    assert.ok(name in dependencies, name);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}

const metrics = load("../lib/support-metrics.ts");
const source = (data = []) => ({ data, count: data.length, error: null });
const sources = () => ({ tickets: source(), events: source(), remediations: source(), sites: source() });

test("coverage confirms complete empty and populated sources without changing inputs", () => {
  for (const size of [0, 1, 1000, 5000]) {
    const input = sources();
    input.events = source(Array.from({ length: size }, () => ({})));
    const before = structuredClone(input);
    assert.equal(metrics.supportMetricsSourceStatus(input), "complete");
    assert.deepEqual(input, before);
  }
});

test("every source requires an exact count matching the returned rows", () => {
  for (const key of Object.keys(sources())) {
    for (const count of [null, undefined, "0", -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 1]) {
      const input = sources();
      input[key].count = count;
      assert.equal(metrics.supportMetricsSourceStatus(input), "incomplete", `${key}:${count}`);
    }
    for (const data of [null, undefined, {}, "", { length: 0 }]) {
      const input = sources();
      input[key].data = data;
      assert.equal(metrics.supportMetricsSourceStatus(input), "incomplete", key);
    }
  }
});

test("API truncation below the requested limit and caller caps both invalidate coverage", () => {
  for (const [returned, total] of [[1000, 1001], [1000, 4999], [5000, 5001], [1, 0]]) {
    const input = sources();
    input.events = { ...source(Array.from({ length: returned }, () => ({}))), count: total };
    assert.equal(metrics.supportMetricsSourceStatus(input), "incomplete");
  }
});

test("query errors take precedence over missing count evidence", () => {
  for (const key of Object.keys(sources())) {
    const input = sources();
    input[key] = { data: null, count: null, error: { code: "synthetic" } };
    assert.equal(metrics.supportMetricsSourceStatus(input), "unavailable");
  }
});

test("installed SDK exposes filtered exact count despite a bounded row response", async () => {
  const requests = [];
  const client = createClient("https://synthetic.invalid", "synthetic-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (url, options) => {
      requests.push({ url: new URL(url), headers: new Headers(options.headers) });
      return new Response(JSON.stringify([{ ticket_id: "synthetic" }]), {
        status: 206, headers: { "content-type": "application/json", "content-range": "0-0/1001" }
      });
    } }
  });
  const result = await client.from("support_ticket_events")
    .select("ticket_id", { count: "exact" }).gte("created_at", "2026-10-01T00:00:00Z").limit(5000);
  assert.equal(requests.length, 1);
  assert.match(requests[0].headers.get("prefer"), /count=exact/);
  assert.equal(requests[0].url.searchParams.get("limit"), "5000");
  assert.equal(requests[0].url.searchParams.get("created_at"), "gte.2026-10-01T00:00:00Z");
  assert.equal(result.count, 1001);
  assert.equal(result.data.length, 1);
  const input = sources();
  input.events = result;
  assert.equal(metrics.supportMetricsSourceStatus(input), "incomplete");
});

test("actual admin route withholds partial KPI but preserves queue, auth and filters", async () => {
  const keys = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"];
  const saved = keys.map(key => process.env[key]);
  keys.forEach(key => { process.env[key] = "synthetic-test"; });
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("{}", { status: 200 });
  try {
    for (const key of ["tickets", "events", "remediations", "sites", null]) {
      for (const mode of key ? ["partial", "missing-count", "error"] : ["complete"]) {
        const input = sources();
        if (key) input[key] = mode === "error"
          ? { data: null, count: null, error: { code: "synthetic-error" } }
          : { data: [], count: mode === "partial" ? 1001 : null, error: null };
        const calls = [];
        let ticketQueries = 0;
        const queue = [{ id: "synthetic-queue-ticket" }];
        const service = { from(table) {
          const call = { table };
          calls.push(call);
          const result = table === "support_tickets" ? (++ticketQueries === 1 ? { data: queue, error: null } : input.tickets)
            : table === "support_ticket_events" ? input.events
              : table === "support_remediation_runs" ? input.remediations : input.sites;
          const builder = {
            select(columns, options) { call.columns = columns; call.options = options; return builder; },
            gte(column, value) { call.since = [column, value]; return builder; },
            eq(column, value) { (call.filters ||= []).push([column, value]); return builder; },
            order() { return builder; },
            limit(limit) { call.limit = limit; return Promise.resolve(result); }
          };
          return builder;
        } };
        const userClient = {
          auth: { getUser: async () => ({ data: { user: { id: "synthetic-admin" } }, error: null }) },
          from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: "admin" }, error: null }) }) }) })
        };
        let clients = 0;
        const route = load("../app/api/admin/support/route.ts", {
          "next/server": { NextResponse: { json: (body, options) => Response.json(body, options) } },
          "node:dns/promises": { resolveAny: async () => [] },
          "@supabase/supabase-js": { createClient: () => ++clients === 1 ? userClient : service },
          "../../../../lib/support-events": {},
          "../../../../lib/support-metrics": metrics,
          "../../../../lib/vercel-runtime-health": { getRecentRuntimeHealth: async () => ({ status: "unknown" }) }
        });
        const request = () => new Request("https://synthetic.invalid/api/admin/support", { headers: { authorization: "Bearer synthetic-token" } });
        const unauthorized = await route.GET(new Request("https://synthetic.invalid/api/admin/support"));
        assert.equal(unauthorized.status, 401);
        assert.equal(calls.length, 0);
        const response = await route.GET(request());
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("cache-control"), "private, no-store");
        const body = await response.json();
        assert.deepEqual(body.tickets, queue);
        if (key) assert.equal(body.metrics, null);
        else assert.equal(body.metrics.ticketsCreated, 0);
        assert.equal(body.metricsStatus, mode === "error" ? "unavailable" : key ? "incomplete" : "complete", `${key}:${mode}`);
        assert.equal(calls.length, 5);
        for (const call of calls.slice(1)) assert.deepEqual(call.options, { count: "exact" });
        assert.deepEqual(calls.map(call => call.limit), [100, 1000, 5000, 5000, 5000]);
        assert.equal(new Set(calls.slice(1, 4).map(call => call.since[1])).size, 1);
        assert.deepEqual(calls[4].filters, [["status", "published"], ["privacy_state", "active"]]);
      }
    }
  } finally {
    globalThis.fetch = savedFetch;
    keys.forEach((key, index) => {
      if (saved[index] === undefined) delete process.env[key]; else process.env[key] = saved[index];
    });
  }
});
