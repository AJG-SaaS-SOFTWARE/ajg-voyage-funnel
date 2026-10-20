import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../app/builder/page.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("builder.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let runInitializer, retryInitializer, legacyRetry;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "runPostPublishHealth") runInitializer = node.initializer;
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "retryPostPublishHealth") retryInitializer = node.initializer;
  if (ts.isJsxAttribute(node) && node.name.getText(ast) === "onClick" && node.initializer &&
      ts.isJsxExpression(node.initializer) && node.initializer.expression &&
      ts.isArrowFunction(node.initializer.expression) &&
      node.initializer.expression.getText(ast).includes("void runPostPublishHealth(remoteSiteId")) {
    legacyRetry = node.initializer.expression;
  }
  ts.forEachChild(node, visit);
}
visit(ast);
retryInitializer ||= legacyRetry;
assert.ok(runInitializer && retryInitializer);
const code = ts.transpileModule(
  `const runPostPublishHealth = ${runInitializer.getText(ast)};
   const retryPostPublishHealth = ${retryInitializer.getText(ast)};`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }
).outputText;
const helper = fs.readFileSync(new URL("../lib/post-publish-health-result.ts", import.meta.url), "utf8");
const helperExports = {};
new Function("exports", ts.transpileModule(helper, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText)(helperExports);
const { readPostPublishDiagnosis } = helperExports;

function diagnosis(overall = "healthy") {
  return { overall, checks: ["backend", "publication", "domain", "billing", "public_render"].map(key => ({
    key, status: key === "public_render" ? overall : "healthy", label: key, detail: "Synthetic display detail"
  })), clientAction: overall === "healthy" ? null : "Open Health Center", repairActions: [],
    generatedAt: "2026-10-20T18:00:00Z" };
}
function response(overall = "healthy", status = 200) {
  return { status, ok: status === 200, redirected: false,
    json: async () => ({ health: { siteId: "site-synthetic", diagnosis: diagnosis(overall) } }) };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
async function flush() { for (let i = 0; i < 20; i++) await Promise.resolve(); }
function fixture({ locale = "fr", siteId = "site-synthetic", absentClient = false, factoryFails = false,
  session = async () => ({ data: { session: { access_token: "synthetic-token" } } }),
  request = async () => response() } = {}) {
  const state = { health: diagnosis(), status: "done" };
  const calls = { factory: 0, session: 0, requests: [] };
  const deps = {
    locale, remoteSiteId: siteId, postPublishHealthVersion: { current: 0 }, readPostPublishDiagnosis,
    setPostPublishHealth: value => { state.health = value; },
    setPostPublishHealthState: value => { state.status = value; },
    getSupabaseBrowserClient() {
      calls.factory++;
      if (factoryFails) throw new Error("private-factory-marker");
      if (absentClient) return null;
      return { auth: { async getSession() { calls.session++; return session(); } } };
    },
    async fetch(...args) { calls.requests.push(args); return request(...args); }
  };
  const handlers = new Function(...Object.keys(deps), code + "\nreturn { runPostPublishHealth, retryPostPublishHealth };")(...Object.values(deps));
  return { state, calls, run: handlers.runPostPublishHealth, retry: handlers.retryPostPublishHealth };
}

for (const locale of ["fr", "en"]) {
  test(`${locale}: successful retry uses the existing authenticated GET and validates its diagnosis`, async () => {
    const f = fixture({ locale, request: async () => response("action") });
    await f.retry(); await flush();
    assert.equal(f.state.status, "done"); assert.equal(f.state.health.overall, "action");
    assert.equal(f.calls.factory, 1); assert.equal(f.calls.session, 1); assert.equal(f.calls.requests.length, 1);
    const [url, options] = f.calls.requests[0];
    assert.equal(url, "/api/support/health?siteId=site-synthetic");
    assert.equal(options.headers.Authorization, "Bearer synthetic-token");
    assert.equal(options.headers["X-AJG-Locale"], locale);
    assert.equal(options.cache, "no-store"); assert.equal(options.redirect, "error");
    assert.equal(JSON.stringify(f.state).includes("synthetic-token"), false);
  });

  test(`${locale}: session or client failures resolve to unavailable instead of keeping old health or escaping`, async () => {
    for (const options of [
      { factoryFails: true }, { absentClient: true },
      { session: async () => { throw new Error("private-session-marker"); } },
      { session: async () => ({ data: { session: null } }) },
      { session: async () => ({ data: {} }) },
      { session: async () => ({ data: { session: { access_token: "synthetic-token" } }, error: { message: "private-sdk-marker" } }) }
    ]) {
      const f = fixture({ locale, ...options });
      await f.retry(); await flush();
      assert.equal(f.state.status, "error"); assert.equal(f.state.health, null);
      assert.equal(f.calls.requests.length, 0);
      assert.equal(JSON.stringify(f.state).includes("private-"), false);
    }
  });
}

test("missing site does not read a session or start a diagnostic request", async () => {
  const f = fixture({ siteId: null });
  await f.retry(); await flush();
  assert.equal(f.calls.factory, 0); assert.equal(f.calls.session, 0); assert.equal(f.calls.requests.length, 0);
  assert.equal(f.state.status, "error"); assert.equal(f.state.health, null);
});

test("starting a retry clears the previous diagnosis before session acquisition completes", async () => {
  const pending = deferred();
  const f = fixture({ session: () => pending.promise });
  const retrying = f.retry();
  const checking = { status: f.state.status, health: f.state.health };
  pending.resolve({ data: { session: { access_token: "synthetic-token" } } });
  await retrying; await flush();
  assert.deepEqual(checking, { status: "checking", health: null });
  assert.equal(f.state.status, "done"); assert.equal(f.calls.requests.length, 1);
});

test("a slow older session success cannot issue a GET after a later retry failed", async () => {
  const old = deferred(); let count = 0;
  const f = fixture({ session: async () => ++count === 1 ? old.promise : { data: { session: null } } });
  const first = f.retry();
  await f.retry();
  old.resolve({ data: { session: { access_token: "synthetic-token" } } });
  await first; await flush();
  assert.equal(f.state.status, "error"); assert.equal(f.state.health, null);
  assert.equal(f.calls.requests.length, 0);
});

test("a slow older session failure cannot erase a later successful diagnostic", async () => {
  const old = deferred(); let count = 0;
  const f = fixture({ session: async () => ++count === 1 ? old.promise
    : { data: { session: { access_token: "synthetic-token" } } }, request: async () => response("incident") });
  const first = f.retry();
  await f.retry(); await flush();
  old.reject(new Error("private-old-session-marker"));
  await first; await flush();
  assert.equal(f.state.status, "done"); assert.equal(f.state.health.overall, "incident");
  assert.equal(f.calls.requests.length, 1);
});

test("a successful automatic publication diagnostic supersedes an older session preflight", async () => {
  const old = deferred();
  const f = fixture({ session: () => old.promise, request: async () => response("action") });
  const first = f.retry();
  await f.run("site-synthetic", "synthetic-token");
  old.resolve({ data: { session: { access_token: "synthetic-token" } } });
  await first; await flush();
  assert.equal(f.state.status, "done"); assert.equal(f.state.health.overall, "action");
  assert.equal(f.calls.requests.length, 1);
});

test("an earlier in-flight GET cannot restore health after a newer retry discovers an expired session", async () => {
  const old = deferred();
  const f = fixture({ session: async () => ({ data: { session: null } }), request: () => old.promise });
  const first = f.run("site-synthetic", "synthetic-token");
  await f.retry();
  old.resolve(response());
  await first; await flush();
  assert.equal(f.state.status, "error"); assert.equal(f.state.health, null);
  assert.equal(f.calls.requests.length, 1);
});

test("HTTP or transport failure is handled by the existing diagnosis reader, with no automatic replay", async () => {
  for (const request of [async () => response("healthy", 503), async () => { throw new Error("private-http-marker"); }]) {
    const f = fixture({ request }); await f.retry(); await flush();
    assert.equal(f.state.status, "error"); assert.equal(f.state.health, null);
    assert.equal(f.calls.session, 1); assert.equal(f.calls.requests.length, 1);
  }
});

test("an explicit later retry can recover from a session read failure without a hidden retry", async () => {
  let count = 0;
  const f = fixture({ session: async () => {
    if (++count === 1) throw new Error("private-first-session-marker");
    return { data: { session: { access_token: "synthetic-token" } } };
  } });
  await f.retry(); await flush();
  assert.equal(f.state.status, "error"); assert.equal(f.state.health, null);
  assert.equal(f.calls.session, 1); assert.equal(f.calls.requests.length, 0);
  await f.retry(); await flush();
  assert.equal(f.state.status, "done"); assert.equal(f.state.health.overall, "healthy");
  assert.equal(f.calls.session, 2); assert.equal(f.calls.requests.length, 1);
});

test("the retry button is actually wired to the reviewed handler", () => {
  assert.match(source, /onClick=\{retryPostPublishHealth\}/);
  assert.ok(!source.includes("void runPostPublishHealth(remoteSiteId, data.session.access_token)"));
});
