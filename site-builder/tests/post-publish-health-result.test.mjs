import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

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
const helperSource = fs.readFileSync(new URL("../lib/post-publish-health-result.ts", import.meta.url), "utf8");
const helperCode = ts.transpileModule(helperSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;
const helperExports = {};
new Function("exports", helperCode)(helperExports);
const { readPostPublishDiagnosis } = helperExports;
const serverSource = fs.readFileSync(new URL("../lib/support-diagnostics.ts", import.meta.url), "utf8");
const serverCode = ts.transpileModule(serverSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;
const serverExports = {};
new Function("exports", serverCode)(serverExports);
const { buildSupportDiagnosis } = serverExports;

function diagnosis(overall = "healthy") {
  const checks = ["backend", "publication", "domain", "billing", "public_render"].map(key => ({
    key, label: key, detail: "Synthetic display detail", status: key === "public_render" ? overall : "healthy"
  }));
  return { overall, checks, clientAction: overall === "healthy" ? null : "Open Health Center",
    repairActions: [], generatedAt: "2026-10-20T17:00:00Z" };
}
function body(overall = "healthy", siteId = "site-synthetic") {
  return { health: { siteId, diagnosis: diagnosis(overall) } };
}
function response(value = body(), status = 200, redirected = false) {
  return { status, ok: status >= 200 && status < 300, redirected, json: async () => value };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function fixture({ locale = "fr", request = async () => response() } = {}) {
  const state = { health: null, status: "idle" };
  const requests = [];
  const deps = {
    locale, postPublishHealthVersion: { current: 0 }, readPostPublishDiagnosis,
    setPostPublishHealth: value => { state.health = value; },
    setPostPublishHealthState: value => { state.status = value; },
    fetch: async (...args) => { requests.push(args); return request(...args); }
  };
  const run = new Function(...Object.keys(deps), code + "\nreturn runPostPublishHealth;")(...Object.values(deps));
  return { state, requests, run };
}

for (const locale of ["fr", "en"]) {
  for (const overall of ["healthy", "action", "incident"]) {
    test(`${locale}: correlated complete ${overall} diagnosis is rendered without changing its meaning`, async () => {
      const expected = body(overall);
      const f = fixture({ locale, request: async () => response(expected) });
      await f.run("site-synthetic", "synthetic-token");
      assert.equal(f.state.status, "done"); assert.deepEqual(f.state.health, expected.health.diagnosis);
      assert.equal(f.requests.length, 1);
      const [url, options] = f.requests[0];
      assert.equal(url, "/api/support/health?siteId=site-synthetic");
      assert.equal(options.headers.Authorization, "Bearer synthetic-token");
      assert.equal(options.headers["X-AJG-Locale"], locale);
      assert.equal(options.cache, "no-store"); assert.equal(options.redirect, "error");
      assert.equal(options.method, undefined);
    });
  }

  test(`${locale}: malformed or uncorrelated successful responses never become display evidence`, async () => {
    const bad = [
      value => { value.health.siteId = "another-site"; },
      value => { delete value.health.siteId; },
      value => { value.health.diagnosis = {}; },
      value => { value.health.diagnosis.checks = null; },
      value => { value.health.diagnosis.checks = []; },
      value => { value.health.diagnosis.checks = value.health.diagnosis.checks.slice(1); },
      value => { value.health.diagnosis.overall = "unknown"; },
      value => { value.health.diagnosis.checks[0].status = "unknown"; },
      value => { value.health.diagnosis.checks[0].label = ""; },
      value => { value.health.diagnosis.checks[0].detail = {}; },
      value => { value.health.diagnosis.checks.push(value.health.diagnosis.checks[0]); },
      value => { value.health.diagnosis.clientAction = {}; },
      value => { value.health.diagnosis.repairActions = ["unknown-action"]; },
      value => { value.health.diagnosis.generatedAt = "invalid-date"; },
      value => { value.health.diagnosis.checks.pop(); },
      value => { value.health.diagnosis.checks[0].status = "incident"; },
      value => { value.health.diagnosis.checks[0].key = "invented"; },
      value => { value.health.diagnosis.checks[0].clientAction = {}; },
      value => { value.health.diagnosis.repairActions = ["managed_domain_repair", "managed_domain_repair"]; }
    ];
    for (const mutate of bad) {
      const value = body(); mutate(value);
      assert.equal(readPostPublishDiagnosis(value, "site-synthetic"), null);
      const f = fixture({ locale, request: async () => response(value) });
      await f.run("site-synthetic", "synthetic-token");
      assert.equal(f.state.status, "error"); assert.equal(f.state.health, null);
      assert.equal(f.requests.length, 1);
    }
  });
}

test("invalid root types and an oversized check collection are rejected", () => {
  for (const value of [null, [], {}, { health: [] }, { health: { siteId: "site-synthetic", diagnosis: [] } }]) {
    assert.equal(readPostPublishDiagnosis(value, "site-synthetic"), null);
  }
  const value = body();
  while (value.health.diagnosis.checks.length < 15) value.health.diagnosis.checks.push(value.health.diagnosis.checks[0]);
  assert.equal(readPostPublishDiagnosis(value, "site-synthetic"), null);
  assert.equal(readPostPublishDiagnosis(body(), ""), null);
});

test("non-200, redirected, malformed JSON and transport failures stay unavailable with no retry", async () => {
  for (const request of [
    ...[201, 204, 302, 401, 404, 500].map(status => async () => response(body(), status)),
    async () => response(body(), 200, true),
    async () => ({ ...response(), json: async () => { throw new Error("private-json-marker"); } }),
    async () => { throw new Error("private-network-marker"); }
  ]) {
    const f = fixture({ request }); await f.run("site-synthetic", "synthetic-token");
    assert.equal(f.state.status, "error"); assert.equal(f.state.health, null);
    assert.equal(f.requests.length, 1);
    assert.equal(JSON.stringify(f.state).includes("private-"), false);
  }
});

test("missing site or access token makes no request and never retains a previous healthy diagnosis", async () => {
  for (const [site, token] of [["", "synthetic-token"], ["site-synthetic", ""]]) {
    const f = fixture(); await f.run("site-synthetic", "synthetic-token");
    const count = f.requests.length;
    await f.run(site, token);
    assert.equal(f.requests.length, count);
    assert.equal(f.state.status, "error"); assert.equal(f.state.health, null);
  }
});

test("a latest successful request cannot be overwritten by older success or failure", async () => {
  for (const oldFails of [false, true]) {
    const old = deferred(); let count = 0;
    const f = fixture({ request: async () => ++count === 1 ? old.promise : response(body("action", "new-site")) });
    const first = f.run("old-site", "synthetic-token");
    await f.run("new-site", "synthetic-token");
    const latest = JSON.stringify(f.state);
    if (oldFails) old.reject(new Error("private-old-marker"));
    else old.resolve(response(body("incident", "old-site")));
    await first;
    assert.equal(JSON.stringify(f.state), latest);
    assert.equal(f.state.status, "done"); assert.equal(f.state.health.overall, "action");
    assert.equal(f.requests.length, 2);
  }
});

test("an older successful response cannot hide failure of the latest request", async () => {
  const old = deferred(); let count = 0;
  const f = fixture({ request: async () => ++count === 1 ? old.promise : response(body(), 503) });
  const first = f.run("site-synthetic", "synthetic-token");
  await f.run("site-synthetic", "synthetic-token");
  old.resolve(response()); await first;
  assert.equal(f.state.status, "error"); assert.equal(f.state.health, null);
});

test("latest-request protection also covers a response whose JSON body arrives late", async () => {
  const json = deferred(); let count = 0;
  const f = fixture({ request: async () => ++count === 1
    ? { ...response(), json: () => json.promise } : response(body("incident")) });
  const first = f.run("site-synthetic", "synthetic-token");
  for (let i = 0; i < 4; i++) await Promise.resolve();
  await f.run("site-synthetic", "synthetic-token");
  json.resolve(body()); await first;
  assert.equal(f.state.status, "done"); assert.equal(f.state.health.overall, "incident");
});

test("new request clears previous evidence while checking and can recover after failure", async () => {
  const pending = deferred(); let count = 0;
  const f = fixture({ request: async () => {
    count++;
    if (count === 1) return response();
    if (count === 2) return pending.promise;
    return response(body("action"));
  } });
  await f.run("site-synthetic", "synthetic-token");
  const checking = f.run("site-synthetic", "synthetic-token");
  assert.equal(f.state.status, "checking"); assert.equal(f.state.health, null);
  pending.resolve(response(body(), 503)); await checking;
  assert.equal(f.state.status, "error"); assert.equal(f.state.health, null);
  await f.run("site-synthetic", "synthetic-token");
  assert.equal(f.state.status, "done"); assert.equal(f.state.health.overall, "action");
  assert.equal(f.requests.length, 3);
});

test("incident/action diagnoses without public-render evidence remain visible and repair options grant no rights", () => {
  for (const overall of ["action", "incident"]) {
    const value = body(overall);
    value.health.diagnosis.checks.pop();
    value.health.diagnosis.checks[0].status = overall;
    value.health.diagnosis.repairActions = ["managed_domain_repair"];
    const before = JSON.stringify(value);
    assert.deepEqual(readPostPublishDiagnosis(value, "site-synthetic"), value.health.diagnosis);
    assert.equal(JSON.stringify(value), before);
  }
});

test("real server diagnosis outputs remain compatible with the client evidence reader", () => {
  const input = {
    backendOk: true, site: { id: "site-synthetic", slug: "synthetic", status: "published", publicAccessState: "live" },
    domains: [{ hostname: "synthetic.example.invalid", kind: "managed_subdomain", verificationStatus: "verified", isPrimary: true }],
    billingState: "active",
    publicRender: { checked: true, ok: true, status: 200, durationMs: 5, canonicalPresent: true, canonicalHttps: true },
    sitemap: { checked: true, ok: true, status: 200, validXml: true },
    backup: { configured: true, status: "healthy", ageHours: 1 },
    ai: { enabled: true, heavyEnabled: true },
    content: { contactEnabled: true, contactEmailValid: true, galleryEnabled: false, galleryImageCount: 0,
      invalidConfiguredLinks: 0, checkedConfiguredLinks: 0, missingPublishableMedia: 0 },
    storage: { publicBucketAvailable: true, privateBucketAvailable: true }
  };
  for (const overrides of [{}, { billingState: "grace" }, { backendOk: false },
    { domains: [] }, { site: { ...input.site, publicAccessState: "suspended" } }]) {
    const diagnosis = buildSupportDiagnosis({ ...input, ...overrides });
    const value = { health: { siteId: "site-synthetic", diagnosis } };
    assert.deepEqual(readPostPublishDiagnosis(value, "site-synthetic"), diagnosis);
  }
  assert.equal(buildSupportDiagnosis(input).checks.length, 14);
});
