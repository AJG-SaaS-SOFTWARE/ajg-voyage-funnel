import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

function load(path, dependencies) {
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

const healthy = { ok: true, service: "ajg-site-builder", database: "ok", environment: "production" };
const json = (body = healthy, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json; charset=utf-8" }
});

async function fixture(action, { response = () => json(), dns = async () => [] } = {}) {
  const saved = globalThis.fetch;
  const requests = [];
  const lookups = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return response(url, options);
  };
  const helper = load("../lib/admin-platform-probe.ts", {
    "node:dns/promises": { resolveAny: async host => { lookups.push(host); return dns(host); } }
  });
  try { return await action({ ...helper, requests, lookups }); }
  finally { globalThis.fetch = saved; }
}

test("application probes require the real positive production health contract", async () => {
  await fixture(async ({ platformProbe, requests, lookups }) => {
    assert.deepEqual(await platformProbe("synthetic.invalid", "/api/health"), {
      host: "synthetic.invalid", dns: "ok", https: "ok", httpStatus: 200
    });
    assert.deepEqual(lookups, ["synthetic.invalid"]);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://synthetic.invalid/api/health");
    assert.equal(requests[0].options.redirect, "manual");
    assert.equal(requests[0].options.cache, "no-store");
    assert.equal(requests[0].options.method, "GET");
    assert.ok(requests[0].options.signal instanceof AbortSignal);
  });
});

test("neither redirects nor 4xx/5xx count as healthy for the app or canary", async () => {
  for (const path of ["/api/health", "/"]) {
    for (const status of [201, 204, 301, 302, 307, 308, 400, 401, 403, 404, 429, 500, 503]) {
      await fixture(async ({ platformProbe, requests }) => {
        const result = await platformProbe("synthetic.invalid", path);
        assert.equal(result.https, "unavailable", `${path}:${status}`);
        assert.equal(result.httpStatus, status);
        assert.equal(requests.length, 1, "no redirect follow or retry");
      }, { response: () => new Response(status === 204 ? null : "untrusted body", { status, headers: { location: "https://outside.invalid/private" } }) });
    }
  }
});

test("HTML 200, non-JSON MIME and malformed/empty JSON cannot substitute for application health", async () => {
  for (const [body, type] of [["<html>login</html>", "text/html"], [JSON.stringify(healthy), "text/plain"], ["{", "application/json"], ["", "application/json"]]) {
    await fixture(async ({ platformProbe }) => {
      const result = await platformProbe("synthetic.invalid", "/api/health");
      assert.equal(result.https, "unavailable");
      assert.equal(result.httpStatus, 200);
      assert.deepEqual(Object.keys(result).sort(), ["dns", "host", "httpStatus", "https"]);
    }, { response: () => new Response(body, { headers: { "content-type": type } }) });
  }
});

test("missing, wrong or truthy-only application evidence is unavailable", async () => {
  const cases = [null, [], {}, { ...healthy, ok: false }, { ...healthy, ok: "true" }, { ...healthy, service: "other-product" }, { ...healthy, database: "unavailable" }, { ...healthy, environment: "preview" }];
  for (const field of Object.keys(healthy)) { const body = { ...healthy }; delete body[field]; cases.push(body); }
  for (const body of cases) {
    await fixture(async ({ platformProbe }) => {
      assert.equal((await platformProbe("synthetic.invalid", "/api/health")).https, "unavailable");
    }, { response: () => json(body) });
  }
});

test("a canary still checks HTTP200 reachability, not a JSON application contract", async () => {
  await fixture(async ({ platformProbe, requests }) => {
    assert.equal((await platformProbe("synthetic.invalid", "/")).https, "ok");
    assert.equal(requests.length, 1);
  }, { response: () => new Response("<html>synthetic canary</html>", { headers: { "content-type": "text/html" } }) });
});

test("health parsing is byte-bounded with or without Content-Length", async () => {
  const text = JSON.stringify({ ...healthy, padding: "x".repeat(17000) });
  for (const declared of [null, "17000"]) {
    let canceled = 0;
    await fixture(async ({ platformProbe }) => {
      assert.equal((await platformProbe("synthetic.invalid", "/api/health")).https, "unavailable");
      assert.equal(canceled, 1);
    }, { response: () => {
      const bytes = new TextEncoder().encode(text);
      const stream = new ReadableStream({ start(controller) { controller.enqueue(bytes); }, cancel() { canceled++; } });
      const headers = { "content-type": "application/json" };
      if (declared) headers["content-length"] = declared;
      return new Response(stream, { headers });
    } });
  }
});

test("a valid chunked health response is accepted and the stream is released", async () => {
  const bytes = new TextEncoder().encode(JSON.stringify({ ...healthy, note: "é" }));
  await fixture(async ({ platformProbe }) => {
    assert.equal((await platformProbe("synthetic.invalid", "/api/health")).https, "ok");
  }, { response: () => new Response(new ReadableStream({ start(controller) {
    for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
    controller.close();
  } }), { headers: { "content-type": "application/json" } }) });
});

test("DNS failure skips HTTP and preserves the existing classification", async () => {
  for (const [code, expected] of [["ENOTFOUND", "nxdomain"], ["ENODATA", "nxdomain"], ["ETIMEOUT", "error"]]) {
    await fixture(async ({ platformProbe, requests }) => {
      assert.deepEqual(await platformProbe("synthetic.invalid", "/api/health"), {
        host: "synthetic.invalid", dns: expected, https: "skipped", httpStatus: null
      });
      assert.equal(requests.length, 0);
    }, { dns: async () => { throw Object.assign(new Error("synthetic"), { code }); } });
  }
});

test("transport and body-read failures never retry or disclose response content", async () => {
  for (const bodyError of [false, true]) {
    await fixture(async ({ platformProbe, requests }) => {
      const result = await platformProbe("synthetic.invalid", "/api/health");
      assert.equal(result.https, "unavailable");
      assert.equal(result.httpStatus, bodyError ? 200 : null);
      assert.equal(requests.length, 1);
      assert.doesNotMatch(JSON.stringify(result), /private-marker/);
    }, { response: () => {
      if (!bodyError) throw Error("private-marker");
      return new Response(new ReadableStream({ start(controller) { controller.error(Error("private-marker")); } }), { headers: { "content-type": "application/json" } });
    } });
  }
});

test("the existing five-second HTTP deadline remains active through body parsing", async () => {
  const savedSet = globalThis.setTimeout;
  const savedClear = globalThis.clearTimeout;
  let expire;
  let cleared = 0;
  globalThis.setTimeout = (callback, delay) => { assert.equal(delay, 5000); expire = callback; return 42; };
  globalThis.clearTimeout = id => { assert.equal(id, 42); cleared++; };
  try {
    await fixture(async ({ platformProbe, requests }) => {
      const pending = platformProbe("synthetic.invalid", "/api/health");
      while (!requests.length) await Promise.resolve();
      expire();
      assert.equal((await pending).https, "unavailable");
      assert.equal(requests[0].options.signal.aborted, true);
      assert.equal(cleared, 1);
    }, { response: (_url, options) => new Response(new ReadableStream({ start(controller) {
      options.signal.addEventListener("abort", () => controller.error(Error("synthetic-abort")), { once: true });
    } }), { headers: { "content-type": "application/json" } }) });
  } finally { globalThis.setTimeout = savedSet; globalThis.clearTimeout = savedClear; }
});

test("the actual admin route propagates refused probe evidence without losing the ticket queue", async () => {
  const keys = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_PUBLISHED_ROOT_DOMAIN"];
  const saved = keys.map(key => process.env[key]);
  keys.forEach(key => { process.env[key] = "synthetic-test"; });
  process.env.NEXT_PUBLIC_APP_URL = "https://app.synthetic.invalid";
  process.env.NEXT_PUBLIC_PUBLISHED_ROOT_DOMAIN = "public.synthetic.invalid";
  try {
    for (const failedHost of [null, "app.synthetic.invalid", "public.synthetic.invalid"]) {
      await fixture(async ({ platformProbe, requests }) => {
        const userClient = {
          auth: { getUser: async () => ({ data: { user: { id: "synthetic-admin" } }, error: null }) },
          from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: "admin" }, error: null }) }) }) })
        };
        let selects = 0;
        const queue = [{ id: "synthetic-ticket" }];
        const service = { from() {
          const result = { data: selects++ === 0 ? queue : [], error: null, count: 0 };
          const builder = {
            select() { return builder; }, gte() { return builder; }, eq() { return builder; }, order() { return builder; },
            limit() { return Promise.resolve(result); }
          };
          return builder;
        } };
        let clients = 0;
        const route = load("../app/api/admin/support/route.ts", {
          "next/server": { NextResponse: { json: (body, options) => Response.json(body, options) } },
          "../../../../lib/admin-platform-probe": { platformProbe },
          "@supabase/supabase-js": { createClient: () => ++clients === 1 ? userClient : service },
          "../../../../lib/support-events": {},
          "../../../../lib/support-metrics": load("../lib/support-metrics.ts", {}),
          "../../../../lib/vercel-runtime-health": { getRecentRuntimeHealth: async () => ({ status: "healthy", checked: true, truncated: false }) },
          "../../../../lib/admin-runtime-observation": load("../lib/admin-runtime-observation.ts", {})
        });
        const denied = await route.GET(new Request("https://synthetic.invalid/api/admin/support"));
        assert.equal(denied.status, 401);
        assert.equal(requests.length, 0);
        assert.equal(selects, 0);
        const response = await route.GET(new Request("https://synthetic.invalid/api/admin/support", { headers: { authorization: "Bearer synthetic-token" } }));
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.deepEqual(body.tickets, queue);
        assert.equal(body.metricsStatus, "complete");
        assert.equal(body.platform.overall, failedHost === "app.synthetic.invalid" ? "incident" : failedHost ? "warning" : "healthy");
        if (failedHost) assert.match(body.platform.nextAction, /n’est pas confirmée/);
        assert.equal(requests.length, 3);
        assert.equal(selects, 5);
      }, { response: (url) => new URL(url).hostname === failedHost
        ? new Response("<html>synthetic wrong response</html>", { headers: { "content-type": "text/html" } })
        : new URL(url).pathname === "/api/health" ? json() : new Response("canary") });
    }
  } finally {
    keys.forEach((key, index) => {
      if (saved[index] === undefined) delete process.env[key]; else process.env[key] = saved[index];
    });
  }
});
