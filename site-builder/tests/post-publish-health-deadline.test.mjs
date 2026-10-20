import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

// Execute the real TSX handler, not an imitation of its request policy.
const source = fs.readFileSync(new URL("../app/builder/page.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("builder.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let initializer;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "runPostPublishHealth") initializer = node.initializer;
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(initializer && ts.isArrowFunction(initializer));
const code = ts.transpileModule(`const runPostPublishHealth = ${initializer.getText(ast)};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;
const helperExports = {};
new Function("exports", ts.transpileModule(
  fs.readFileSync(new URL("../lib/post-publish-health-result.ts", import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  }).outputText)(helperExports);
const { readPostPublishDiagnosis } = helperExports;

function body(overall = "healthy") {
  return { health: { siteId: "site-synthetic", diagnosis: { overall,
    checks: ["backend", "publication", "domain", "billing", "public_render"].map(key => ({
      key, status: key === "public_render" ? overall : "healthy", label: key, detail: "Synthetic display detail"
    })), clientAction: null, repairActions: [], generatedAt: "2026-10-20T19:00:00Z"
  } } };
}
function response(overall = "healthy", status = 200) {
  return { status, ok: status === 200, redirected: false, json: async () => body(overall) };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
async function flush() { for (let i = 0; i < 30; i++) await Promise.resolve(); }
function fixture({ locale = "fr", request = async () => response() } = {}) {
  const state = { status: "done", health: body().health.diagnosis };
  const calls = [], deadlines = [], cleared = [], timers = new Map();
  let next = 0;
  const deps = {
    locale, postPublishHealthVersion: { current: 0 }, readPostPublishDiagnosis, AbortController,
    setPostPublishHealth: value => { state.health = value; },
    setPostPublishHealthState: value => { state.status = value; },
    fetch: async (...args) => { calls.push(args); return request(...args); },
    setTimeout: (fn, ms) => { const id = ++next; deadlines.push(ms); timers.set(id, fn); return id; },
    clearTimeout: id => { cleared.push(id); timers.delete(id); }
  };
  const run = new Function(...Object.keys(deps), code + "\nreturn runPostPublishHealth;")(...Object.values(deps));
  const expire = (id = timers.keys().next().value) => {
    const fn = timers.get(id); if (fn) { timers.delete(id); fn(); }
  };
  return { state, calls, deadlines, cleared, timers, run, expire };
}

for (const locale of ["fr", "en"]) {
  test(`${locale}: one bounded GET preserves locale, ownership token and validated diagnosis`, async () => {
    for (const overall of ["healthy", "action", "incident"]) {
      const f = fixture({ locale, request: async () => response(overall) });
      await f.run("site-synthetic", "synthetic-token");
      assert.equal(f.state.status, "done"); assert.deepEqual(f.state.health, body(overall).health.diagnosis);
      assert.equal(f.calls.length, 1); assert.deepEqual(f.deadlines, [30000]);
      assert.equal(f.timers.size, 0); assert.deepEqual(f.cleared, [1]);
      const [url, options] = f.calls[0];
      assert.equal(url, "/api/support/health?siteId=site-synthetic");
      assert.deepEqual(options.headers, { Authorization: "Bearer synthetic-token", "X-AJG-Locale": locale });
      assert.equal(options.method, undefined); assert.equal(options.cache, "no-store"); assert.equal(options.redirect, "error");
      assert.ok(options.signal instanceof AbortSignal); assert.equal(options.signal.aborted, false);
    }
  });

  for (const stage of ["headers", "body"]) {
    for (const failsLate of [false, true]) {
      test(`${locale}: deadline settles pending ${stage}; late ${failsLate ? "failure" : "success"} cannot restore evidence`, async () => {
        const pending = deferred();
        const f = fixture({ locale, request: async () => stage === "headers"
          ? pending.promise : { ...response(), json: () => pending.promise } });
        let settled = false;
        const operation = f.run("site-synthetic", "synthetic-token").then(() => { settled = true; });
        assert.equal(f.state.status, "checking"); assert.equal(f.state.health, null);
        await flush(); f.expire(); await flush();
        const atDeadline = { status: f.state.status, health: f.state.health, settled };
        const aborted = f.calls[0]?.[1].signal?.aborted;
        // Release the deliberately abort-ignoring transport even on the baseline.
        if (failsLate) pending.reject(new Error("private-late-marker"));
        else pending.resolve(stage === "headers" ? response() : body());
        await operation; await flush();
        assert.deepEqual(atDeadline, { status: "error", health: null, settled: true });
        assert.equal(aborted, true);
        assert.equal(f.state.status, "error"); assert.equal(f.state.health, null);
        assert.equal(f.calls.length, 1); assert.equal(f.timers.size, 0);
        assert.equal(JSON.stringify(f.state).includes("private-"), false);
      });
    }
  }

  test(`${locale}: older deadline cannot hide a newer diagnosis`, async () => {
    const old = deferred(); let count = 0;
    const f = fixture({ locale, request: async () => ++count === 1 ? old.promise : response("incident") });
    const first = f.run("site-synthetic", "synthetic-token");
    await flush(); const oldTimer = f.timers.keys().next().value;
    await f.run("site-synthetic", "synthetic-token");
    f.expire(oldTimer); await flush();
    const snapshot = JSON.stringify(f.state);
    old.resolve(response()); await first;
    assert.equal(JSON.stringify(f.state), snapshot);
    assert.equal(f.state.status, "done"); assert.equal(f.state.health.overall, "incident");
    assert.equal(f.calls.length, 2); assert.equal(f.timers.size, 0);
    assert.equal(f.calls[0][1].signal?.aborted, true);
    assert.equal(f.calls[1][1].signal?.aborted, false);
  });

  test(`${locale}: independent deadlines do not cancel a newer pending read`, async () => {
    const old = deferred(), latest = deferred(); let count = 0;
    const f = fixture({ locale, request: async () => ++count === 1 ? old.promise : latest.promise });
    const first = f.run("site-synthetic", "synthetic-token");
    const second = f.run("site-synthetic", "synthetic-token");
    await flush(); f.expire(1); await flush();
    const intermediate = { status: f.state.status, health: f.state.health };
    const active = [...f.timers.keys()];
    old.resolve(response()); latest.resolve(response("action"));
    await Promise.all([first, second]);
    assert.deepEqual(intermediate, { status: "checking", health: null });
    assert.deepEqual(active, [2]); assert.equal(f.timers.size, 0);
    assert.equal(f.state.status, "done"); assert.equal(f.state.health.overall, "action");
    assert.equal(f.calls[1][1].signal?.aborted, false);
  });

  test(`${locale}: an explicit later read can recover without an automatic retry`, async () => {
    const pending = deferred(); let count = 0;
    const f = fixture({ locale, request: async () => ++count === 1 ? pending.promise : response("action") });
    const first = f.run("site-synthetic", "synthetic-token");
    await flush(); f.expire(); await flush();
    const failed = f.state.status; const countAtExpiry = f.calls.length;
    pending.resolve(response()); await first;
    await f.run("site-synthetic", "synthetic-token");
    assert.equal(failed, "error"); assert.equal(countAtExpiry, 1);
    assert.equal(f.state.status, "done"); assert.equal(f.state.health.overall, "action");
    assert.equal(f.calls.length, 2); assert.equal(f.timers.size, 0);
  });
}

test("fast HTTP, transport and body failures clear their deadline without exposing errors", async () => {
  for (const request of [
    async () => response("healthy", 503),
    async () => { throw new Error("private-transport-marker"); },
    async () => ({ ...response(), json: async () => { throw new Error("private-json-marker"); } })
  ]) {
    const f = fixture({ request }); await f.run("site-synthetic", "synthetic-token");
    assert.equal(f.state.status, "error"); assert.equal(f.state.health, null);
    assert.deepEqual(f.deadlines, [30000]); assert.deepEqual(f.cleared, [1]);
    assert.equal(f.timers.size, 0); assert.equal(f.calls.length, 1);
    assert.equal(JSON.stringify(f.state).includes("private-"), false);
  }
});

test("missing site/token makes no request and allocates no deadline", async () => {
  for (const [site, token] of [["", "synthetic-token"], ["site-synthetic", ""]]) {
    const f = fixture(); await f.run(site, token);
    assert.equal(f.state.status, "error"); assert.equal(f.state.health, null);
    assert.equal(f.calls.length, 0); assert.deepEqual(f.deadlines, []);
    assert.deepEqual(f.cleared, []); assert.equal(f.timers.size, 0);
  }
});

test("an abort-aware pending fetch really receives the deadline cancellation", async () => {
  const f = fixture({ request: (_url, options) => new Promise((_resolve, reject) => {
    assert.ok(options.signal);
    options.signal.addEventListener("abort", () => reject(new Error("private-abort-marker")), { once: true });
  }) });
  const operation = f.run("site-synthetic", "synthetic-token");
  await flush(); f.expire(); await operation;
  assert.equal(f.state.status, "error"); assert.equal(f.state.health, null);
  assert.equal(f.calls.length, 1); assert.equal(f.timers.size, 0);
  assert.equal(f.calls[0][1].signal?.aborted, true);
});
