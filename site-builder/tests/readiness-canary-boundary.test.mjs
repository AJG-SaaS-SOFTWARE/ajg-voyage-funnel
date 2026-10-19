import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const compile = file => ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const routeCode = compile("../app/api/admin/release-readiness/route.ts");
const domainsCode = compile("../lib/published-domain.ts");

// Actual handler and target validator, with isolated SDK/HTTP doubles only.
// Hostile strings never leave this process and no DNS lookup is performed.
function harness({ hostname = "demo.eltara.ajgsolutionsgroup.com", status = 200,
  role = "admin", token = "fixture-token", lookupError = false, transportError = false,
  env = {} } = {}) {
  const calls = [], queries = [];
  const processDouble = { env: { NEXT_PUBLIC_SUPABASE_URL: "https://fixture.example.invalid",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-public", SUPABASE_SECRET_KEY: "fixture-service", ...env } };
  const domains = { exports: {} };
  new Function("module", "exports", "process", domainsCode)(domains, domains.exports, processDouble);
  function from(table) {
    const query = { table, filters: {} }; queries.push(query);
    const result = () => ({ data: table === "user_roles" ? { role }
      : table === "domains" ? { hostname } : null,
      error: table === "domains" && lookupError ? { code: "fixture-read-failed" } : null });
    const chain = {
      select(columns) { query.columns = columns; return chain; },
      eq(key, value) { query.filters[key] = value; return chain; },
      order() { return chain; }, limit() { return chain; },
      maybeSingle: async () => result()
    };
    return chain;
  }
  const dependencies = {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@supabase/supabase-js": { createClient: () => ({ from,
      auth: { getUser: async () => ({ data: { user: { id: "fixture-admin" } }, error: null }) },
      storage: { getBucket: async () => ({ data: { public: false }, error: null }) } }) },
    "../../../../lib/app-url": { appBaseUrl: () => "https://builder.example.invalid" },
    "../../../../lib/storage-backup": { getStorageBackupStatus: async () => { throw Error("Unexpected backup read"); } },
    "../../../../lib/commercial-checkout-readiness": { commercialConfigurationReadiness: () => ({ stripe: { ok: false, missing: [] }, legal: { ok: false, missing: [] }, tax: { ok: false, reason: "fixture not approved" } }) },
    "../../../../lib/stripe-readiness": { auditStripeRuntimeCached: async () => { throw Error("Unexpected Stripe read"); } },
    "../../../../lib/openai-readiness": { auditOpenAiRuntimeCached: async () => ({ status: "blocker", detail: "fixture blocked" }) },
    "../../../../lib/support-agent-status": { supportAgentStatus: () => "healthy" },
    "../../../../lib/ai-finops-readiness": {},
    "../../../../lib/release-e2e-policy": {},
    "../../../../lib/published-domain": domains.exports
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", "process", "fetch", routeCode)(name => {
    assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name];
  }, module, module.exports, processDouble, async (url, options) => {
    calls.push({ url: String(url), options });
    if (transportError) throw Error("private transport detail");
    return new Response(null, { status, headers: status >= 300 && status < 400
      ? { location: "https://outside.example.invalid/private" } : {} });
  });
  return { calls, queries, domains: domains.exports,
    async run() { const response = await module.exports.GET(new Request("https://builder.example.invalid/api/admin/release-readiness", {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })); return { response, body: await response.json() }; } };
}

const invalid = ["outside.example.invalid", "127.0.0.1", "169.254.169.254", "[::1]",
  "demo.eltara.ajgsolutionsgroup.com@outside.example.invalid", "outside.example.invalid#demo.eltara.ajgsolutionsgroup.com",
  "https://demo.eltara.ajgsolutionsgroup.com", "demo.eltara.ajgsolutionsgroup.com/path",
  "demo.eltara.ajgsolutionsgroup.com:443", "demo.eltara.ajgsolutionsgroup.com?x=1",
  "demo.eltara.ajgsolutionsgroup.com.outside.example.invalid", "nested.demo.eltara.ajgsolutionsgroup.com",
  "-bad.eltara.ajgsolutionsgroup.com", `${"a".repeat(64)}.eltara.ajgsolutionsgroup.com`,
  "demo_.eltara.ajgsolutionsgroup.com", "demo.eltara.ajgsolutionsgroup.com.",
  "demo\\.eltara.ajgsolutionsgroup.com", "demo%2f.eltara.ajgsolutionsgroup.com",
  " demo.eltara.ajgsolutionsgroup.com", "démo.eltara.ajgsolutionsgroup.com", "", null];
for (const hostname of invalid) {
  test(`readiness refuses an untrusted or malformed canary: ${hostname}`, async () => {
    const app = harness({ hostname }); const { body } = await app.run();
    assert.deepEqual(app.calls, []);
    assert.equal(body.checks.find(check => check.key === "managed-subdomains").status, "warn");
  });
}

for (const hostname of ["demo.eltara.ajgsolutionsgroup.com", "DEMO.ELTARA.AJGSOLUTIONSGROUP.COM", "demo.voyage.ajgsolutionsgroup.com"]) {
  test(`readiness probes only the canonical managed target: ${hostname}`, async () => {
    const app = harness({ hostname }); const { body } = await app.run();
    assert.equal(app.calls.length, 1);
    assert.equal(app.calls[0].url, `https://${hostname.toLowerCase()}/`);
    assert.equal(app.calls[0].options.redirect, "manual");
    assert.equal(app.calls[0].options.cache, "no-store");
    assert.ok(app.calls[0].options.signal instanceof AbortSignal);
    assert.equal(body.checks.find(check => check.key === "managed-subdomains").status, "pass");
    assert.deepEqual(app.queries.find(query => query.table === "domains").filters,
      { kind: "managed_subdomain", verification_status: "verified", is_primary: true });
  });
}

test("a redirect is not followed or reported as a healthy canary", async () => {
  const app = harness({ status: 302 }); const { body } = await app.run();
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0].options.redirect, "manual");
  assert.equal(body.checks.find(check => check.key === "managed-subdomains").status, "warn");
  assert.doesNotMatch(JSON.stringify(body), /outside\.example\.invalid/);
});

for (const options of [{ role: "client" }, { token: "" }, { lookupError: true }]) {
  test(`canary performs no HTTP request on denied access or uncertain lookup: ${JSON.stringify(options)}`, async () => {
    const app = harness(options); await app.run(); assert.deepEqual(app.calls, []);
  });
}

test("a valid canary with a failed probe stays warning without leaking the error", async () => {
  const app = harness({ transportError: true }); const { body } = await app.run();
  assert.equal(app.calls.length, 1);
  assert.equal(body.checks.find(check => check.key === "managed-subdomains").status, "warn");
  assert.doesNotMatch(JSON.stringify(body), /private transport detail/);
});

test("the canary uses current trusted root configuration, not arbitrary stored hostnames", async () => {
  const env = { NEXT_PUBLIC_PUBLISHED_ROOT_DOMAIN: "sites.example.invalid",
    NEXT_PUBLIC_LEGACY_PUBLISHED_ROOT_DOMAINS: "old.example.invalid" };
  for (const root of ["sites.example.invalid", "old.example.invalid"]) {
    const app = harness({ hostname: `demo.${root}`, env }); await app.run();
    assert.equal(app.calls[0].url, `https://demo.${root}/`);
  }
  const app = harness({ hostname: "demo.eltara.ajgsolutionsgroup.com", env }); await app.run();
  assert.deepEqual(app.calls, []);
  // Existing routing/display normalization remains unchanged.
  assert.equal(app.domains.managedSlugFromHostname("https://demo.sites.example.invalid/path"), "demo");
});
