import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL("../lib/support-diagnostics.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
new Function("require", "module", "exports", code)(require, module, module.exports);
const { buildSupportDiagnosis } = module.exports;

test("healthy published site does not create a false support incident", () => {
  const result = buildSupportDiagnosis({
    backendOk: true,
    site: { id: "site", slug: "demo", status: "published", publicAccessState: "live" },
    domains: [{ hostname: "demo.example.com", verificationStatus: "verified", isPrimary: true }],
    billingState: "active",
    publicRender: { checked: true, ok: true, status: 200 }
  });
  assert.equal(result.overall, "healthy");
  assert.equal(result.clientAction, null);
});

test("draft and pending DNS produce guided customer action rather than incident escalation", () => {
  const result = buildSupportDiagnosis({
    backendOk: true,
    site: { id: "site", slug: "demo", status: "draft", publicAccessState: "live" },
    domains: [{ hostname: "demo.example.com", verificationStatus: "pending", isPrimary: false }],
    billingState: "active"
  });
  assert.equal(result.overall, "action");
  assert.ok(result.clientAction);
  assert.ok(result.checks.some((check) => check.key === "domain" && check.status === "action"));
});

test("suspended or restricted site is treated as an incident", () => {
  const result = buildSupportDiagnosis({
    backendOk: true,
    site: { id: "site", slug: "demo", status: "published", publicAccessState: "suspended" },
    domains: [],
    billingState: "restricted"
  });
  assert.equal(result.overall, "incident");
  assert.ok(result.checks.some((check) => check.key === "billing" && check.status === "incident"));
});

test("backend failure is surfaced even when no site can be inspected", () => {
  const result = buildSupportDiagnosis({ backendOk: false, site: null, domains: [], billingState: null });
  assert.equal(result.overall, "incident");
});


test("failed public render escalates a published live site", () => {
  const result = buildSupportDiagnosis({
    backendOk: true,
    site: { id: "site", slug: "demo", status: "published", publicAccessState: "live" },
    domains: [],
    billingState: "active",
    publicRender: { checked: true, ok: false, status: 500 },
    backup: { configured: true, status: "healthy", ageHours: 4 },
    ai: { enabled: true, heavyEnabled: true }
  });
  assert.equal(result.overall, "incident");
  assert.ok(result.checks.some((check) => check.key === "public_render" && check.status === "incident"));
});

test("stale backup is an infrastructure incident but warning backup is not a customer action", () => {
  const critical = buildSupportDiagnosis({
    backendOk: true,
    site: { id: "site", slug: "demo", status: "published", publicAccessState: "live" },
    domains: [],
    billingState: "active",
    publicRender: { checked: true, ok: true, status: 200 },
    backup: { configured: true, status: "critical", ageHours: 80 },
    ai: { enabled: true, heavyEnabled: true }
  });
  assert.equal(critical.overall, "incident");
  assert.equal(critical.clientAction, null);

  const warning = buildSupportDiagnosis({
    backendOk: true,
    site: { id: "site", slug: "demo", status: "published", publicAccessState: "live" },
    domains: [],
    billingState: "active",
    publicRender: { checked: true, ok: true, status: 200 },
    backup: { configured: true, status: "warning", ageHours: 48 },
    ai: { enabled: true, heavyEnabled: true }
  });
  assert.equal(warning.overall, "action");
  assert.equal(warning.clientAction, null);
});

test("global AI circuit breaker is visible without claiming the site is down", () => {
  const result = buildSupportDiagnosis({
    backendOk: true,
    site: { id: "site", slug: "demo", status: "published", publicAccessState: "live" },
    domains: [],
    billingState: "active",
    publicRender: { checked: true, ok: true, status: 200 },
    backup: { configured: true, status: "healthy", ageHours: 1 },
    ai: { enabled: false, heavyEnabled: false }
  });
  assert.equal(result.overall, "incident");
  assert.ok(result.checks.some((check) => check.key === "ai" && check.status === "incident"));
});


test("published site exposes healthy canonical sitemap and latency signals", () => {
  const result = buildSupportDiagnosis({
    backendOk: true,
    site: { id: "site", slug: "demo", status: "published", publicAccessState: "live" },
    domains: [],
    billingState: "active",
    publicRender: {
      checked: true,
      ok: true,
      status: 200,
      durationMs: 420,
      canonicalPresent: true,
      canonicalHttps: true
    },
    sitemap: { checked: true, ok: true, status: 200, validXml: true }
  });
  assert.ok(result.checks.some((check) => check.key === "latency" && check.status === "healthy"));
  assert.ok(result.checks.some((check) => check.key === "seo" && check.status === "healthy"));
  assert.ok(result.checks.some((check) => check.key === "sitemap" && check.status === "healthy"));
  assert.equal(result.overall, "healthy");
});

test("slow render or broken SEO routes become AJG diagnostic actions without customer blame", () => {
  const result = buildSupportDiagnosis({
    backendOk: true,
    site: { id: "site", slug: "demo", status: "published", publicAccessState: "live" },
    domains: [],
    billingState: "active",
    publicRender: {
      checked: true,
      ok: true,
      status: 200,
      durationMs: 4200,
      canonicalPresent: false,
      canonicalHttps: false
    },
    sitemap: { checked: true, ok: false, status: 404, validXml: false }
  });
  assert.equal(result.overall, "action");
  assert.equal(result.clientAction, null);
  assert.ok(result.checks.some((check) => check.key === "latency" && check.status === "action"));
  assert.ok(result.checks.some((check) => check.key === "seo" && check.status === "action"));
  assert.ok(result.checks.some((check) => check.key === "sitemap" && check.status === "action"));
});

test("server-side sitemap failure is escalated as an incident", () => {
  const result = buildSupportDiagnosis({
    backendOk: true,
    site: { id: "site", slug: "demo", status: "published", publicAccessState: "live" },
    domains: [],
    billingState: "active",
    publicRender: { checked: true, ok: true, status: 200 },
    sitemap: { checked: true, ok: false, status: 503, validXml: false }
  });
  assert.equal(result.overall, "incident");
  assert.ok(result.checks.some((check) => check.key === "sitemap" && check.status === "incident"));
});
