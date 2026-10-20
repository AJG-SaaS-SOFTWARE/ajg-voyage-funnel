import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../app/builder/page.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("builder.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let runInitializer, retryInitializer;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "runPostPublishHealth") runInitializer = node.initializer;
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "retryPostPublishHealth") retryInitializer = node.initializer;
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(runInitializer && retryInitializer);
const code = ts.transpileModule(
  `const runPostPublishHealth = ${runInitializer.getText(ast)};
   const retryPostPublishHealth = ${retryInitializer.getText(ast)};`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }
).outputText;
const helperExports = {};
new Function("exports", ts.transpileModule(
  fs.readFileSync(new URL("../lib/post-publish-health-result.ts", import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  }).outputText)(helperExports);
const { readPostPublishDiagnosis } = helperExports;

function diagnosis(overall = "healthy") {
  return { overall, checks: ["backend", "publication", "domain", "billing", "public_render"].map(key => ({
    key, status: key === "public_render" ? overall : "healthy", label: key, detail: "Synthetic display detail"
  })), clientAction: null, repairActions: [], generatedAt: "2026-10-20T20:00:00Z" };
}
function response(overall = "healthy") {
  return { status: 200, ok: true, redirected: false,
    json: async () => ({ health: { siteId: "site-synthetic", diagnosis: diagnosis(overall) } }) };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
async function flush() { for (let i = 0; i < 30; i++) await Promise.resolve(); }

function fixture({ locale = "fr", siteId = "site-synthetic", absentClient = false,
  session = async () => ({ data: { session: { access_token: "synthetic-token" } } }),
  request = async () => response() } = {}) {
  const state = { status: "done", health: diagnosis() };
  const calls = { factory: 0, session: 0, requests: [] };
  const deadlines = [], cleared = [], timers = new Map();
  let nextTimer = 0;
  const deps = {
    locale, remoteSiteId: siteId, postPublishHealthVersion: { current: 0 }, readPostPublishDiagnosis,
    setPostPublishHealth: value => { state.health = value; },
    setPostPublishHealthState: value => { state.status = value; },
    getSupabaseBrowserClient() {
      calls.factory++;
      if (absentClient) return null;
      return { auth: { async getSession() { calls.session++; return session(); } } };
    },
    async fetch(...args) { calls.requests.push(args); return request(...args); },
    setTimeout(fn, ms) {
      const id = ++nextTimer;
      deadlines.push({ id, ms });
      timers.set(id, fn);
      return id;
    },
    clearTimeout(id) {
      cleared.push(id);
      timers.delete(id);
    },
    AbortController
  };
  const handlers = new Function(...Object.keys(deps),
    code + "\nreturn { runPostPublishHealth, retryPostPublishHealth };")(...Object.values(deps));
  const expire = id => {
    const fn = timers.get(id);
    if (fn) {
      timers.delete(id);
      fn();
    }
  };
  return { state, calls, deadlines, cleared, timers, expire,
    run: handlers.runPostPublishHealth, retry: handlers.retryPostPublishHealth };
}

for (const locale of ["fr", "en"]) {
  test(`${locale}: pending session preflight settles unavailable at its logical deadline`, async () => {
    for (const lateFails of [false, true]) {
      const pending = deferred();
      const f = fixture({ locale, session: () => pending.promise });
      let settled = false;
      const operation = f.retry().then(() => { settled = true; });
      await flush();
      assert.deepEqual(f.deadlines, [{ id: 1, ms: 15000 }]);
      assert.deepEqual({ status: f.state.status, health: f.state.health }, { status: "checking", health: null });
      f.expire(1); await operation; await flush();
      assert.equal(settled, true);
      assert.equal(f.state.status, "error"); assert.equal(f.state.health, null);
      assert.equal(f.calls.session, 1); assert.equal(f.calls.requests.length, 0);
      if (lateFails) pending.reject(new Error("private-late-session-marker"));
      else pending.resolve({ data: { session: { access_token: "synthetic-token" } } });
      await flush();
      assert.equal(f.state.status, "error"); assert.equal(f.state.health, null);
      assert.equal(f.calls.requests.length, 0);
      assert.equal(JSON.stringify(f.state).includes("private-"), false);
    }
  });

  test(`${locale}: successful session clears its timer before the bounded health GET`, async () => {
    const pendingGet = deferred();
    const f = fixture({ locale, request: () => pendingGet.promise });
    const operation = f.retry(); await flush();
    assert.deepEqual(f.deadlines, [{ id: 1, ms: 15000 }, { id: 2, ms: 30000 }]);
    assert.ok(f.cleared.includes(1));
    assert.equal(f.timers.has(1), false); assert.equal(f.timers.has(2), true);
    assert.equal(f.calls.session, 1); assert.equal(f.calls.requests.length, 1);
    pendingGet.resolve(response("action")); await operation;
    assert.equal(f.state.status, "done"); assert.equal(f.state.health.overall, "action");
    assert.equal(f.timers.size, 0); assert.ok(f.cleared.includes(2));
  });

  test(`${locale}: explicit retry recovers after timeout without hidden session or GET retry`, async () => {
    const old = deferred(); let count = 0;
    const f = fixture({ locale, session: async () => ++count === 1 ? old.promise
      : { data: { session: { access_token: "synthetic-token" } } } });
    const first = f.retry(); await flush(); f.expire(1); await first;
    const countAtDeadline = { sessions: f.calls.session, requests: f.calls.requests.length };
    await f.retry(); await flush();
    assert.deepEqual(countAtDeadline, { sessions: 1, requests: 0 });
    assert.equal(f.calls.session, 2); assert.equal(f.calls.requests.length, 1);
    assert.equal(f.state.status, "done");
    old.resolve({ data: { session: { access_token: "synthetic-token" } } }); await flush();
    assert.equal(f.calls.requests.length, 1); assert.equal(f.state.status, "done");
  });
}

test("an older session timeout cannot erase a newer successful diagnosis", async () => {
  const old = deferred(); let count = 0;
  const f = fixture({ session: async () => ++count === 1 ? old.promise
    : { data: { session: { access_token: "synthetic-token" } } }, request: async () => response("incident") });
  const first = f.retry(); await flush();
  await f.retry(); await flush();
  const snapshot = JSON.stringify(f.state);
  f.expire(1); await first; await flush();
  assert.equal(JSON.stringify(f.state), snapshot);
  assert.equal(f.state.status, "done"); assert.equal(f.state.health.overall, "incident");
  assert.equal(f.calls.requests.length, 1);
  old.resolve({ data: { session: { access_token: "late-token" } } }); await flush();
  assert.equal(f.calls.requests.length, 1);
});

test("each concurrent session preflight owns its deadline", async () => {
  const firstSession = deferred(), secondSession = deferred(); let count = 0;
  const f = fixture({ session: () => ++count === 1 ? firstSession.promise : secondSession.promise });
  const first = f.retry(), second = f.retry(); await flush();
  assert.deepEqual(f.deadlines, [{ id: 1, ms: 15000 }, { id: 2, ms: 15000 }]);
  f.expire(1); await first; await flush();
  assert.equal(f.state.status, "checking"); assert.equal(f.state.health, null);
  assert.equal(f.timers.has(2), true); assert.equal(f.calls.requests.length, 0);
  secondSession.resolve({ data: { session: { access_token: "synthetic-token" } } });
  await second; await flush();
  assert.equal(f.state.status, "done"); assert.equal(f.calls.requests.length, 1);
  firstSession.resolve({ data: { session: { access_token: "late-token" } } }); await flush();
  assert.equal(f.calls.requests.length, 1);
});

test("fast session outcomes clear the deadline and preserve no private error detail", async () => {
  for (const session of [
    async () => { throw new Error("private-fast-session-marker"); },
    async () => ({ data: { session: null } }),
    async () => ({ data: { session: { access_token: "synthetic-token" } }, error: { message: "private-sdk-marker" } })
  ]) {
    const f = fixture({ session }); await f.retry(); await flush();
    assert.deepEqual(f.deadlines, [{ id: 1, ms: 15000 }]);
    assert.deepEqual(f.cleared, [1]); assert.equal(f.timers.size, 0);
    assert.equal(f.state.status, "error"); assert.equal(f.state.health, null);
    assert.equal(f.calls.requests.length, 0);
    assert.equal(JSON.stringify(f.state).includes("private-"), false);
  }
});

test("missing site or browser client allocates no session deadline and makes no request", async () => {
  for (const options of [{ siteId: null }, { absentClient: true }]) {
    const f = fixture(options); await f.retry(); await flush();
    assert.deepEqual(f.deadlines, []); assert.deepEqual(f.cleared, []);
    assert.equal(f.calls.requests.length, 0); assert.equal(f.state.status, "error");
  }
});

test("both visible recovery states reuse the bounded handler without auth mutation", () => {
  assert.match(source, /onClick={retryPostPublishHealth}/);
  assert.equal(source.match(/onClick={retryPostPublishHealth}/g)?.length, 2);
  const retryText = retryInitializer.getText(ast);
  assert.match(retryText, /supabase\.auth\.getSession\(\)/);
  assert.doesNotMatch(retryText, /signOut|refreshSession|setSession|updateUser|abort\(/);
});
