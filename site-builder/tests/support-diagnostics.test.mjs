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
    domains: [{
      hostname: "demo.voyage.ajgsolutionsgroup.com",
      kind: "managed_subdomain",
      verificationStatus: "verified",
      isPrimary: true
    }],
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


test("published site with no platform domain advertises deterministic repair", () => {
  const result = buildSupportDiagnosis({
    backendOk: true,
    site: { id: "site", slug: "demo", status: "published", publicAccessState: "live" },
    domains: [],
    billingState: "active",
    publicRender: { checked: true, ok: true, status: 200 }
  });
  assert.equal(result.overall, "action");
  assert.deepEqual(result.repairActions, ["managed_domain_repair"]);
  assert.equal(result.clientAction, null);
});


test("content health flags enabled contact, gallery and publishable-media gaps with client actions", () => {
  const result = buildSupportDiagnosis({
    backendOk: true,
    site: { id: "site", slug: "demo", status: "published", publicAccessState: "live" },
    domains: [{ hostname: "demo.example.com", verificationStatus: "verified", isPrimary: true }],
    billingState: "active",
    publicRender: { checked: true, ok: true, status: 200 },
    content: {
      contactEnabled: true,
      contactEmailValid: false,
      galleryEnabled: true,
      galleryImageCount: 0,
      invalidConfiguredLinks: 1,
      checkedConfiguredLinks: 2,
      missingPublishableMedia: 1
    },
    storage: { publicBucketAvailable: true, privateBucketAvailable: true }
  });

  assert.equal(result.overall, "action");
  assert.ok(result.checks.some((check) => check.key === "contact" && check.status === "action" && check.clientAction));
  assert.ok(result.checks.some((check) => check.key === "images" && check.status === "action" && check.clientAction));
  assert.ok(result.checks.some((check) => check.key === "content_links" && check.status === "action" && check.clientAction));
  assert.ok(result.checks.some((check) => check.key === "storage" && check.status === "healthy"));
});

test("missing required storage bucket is an infrastructure incident without customer blame", () => {
  const result = buildSupportDiagnosis({
    backendOk: true,
    site: { id: "site", slug: "demo", status: "published", publicAccessState: "live" },
    domains: [{ hostname: "demo.example.com", verificationStatus: "verified", isPrimary: true }],
    billingState: "active",
    publicRender: { checked: true, ok: true, status: 200 },
    storage: { publicBucketAvailable: true, privateBucketAvailable: false }
  });

  assert.equal(result.overall, "incident");
  const check = result.checks.find((item) => item.key === "storage");
  assert.equal(check?.status, "incident");
  assert.equal(check?.clientAction, undefined);
});

test("healthy configured content does not create a false customer action", () => {
  const result = buildSupportDiagnosis({
    backendOk: true,
    site: { id: "site", slug: "demo", status: "published", publicAccessState: "live" },
    domains: [{ hostname: "demo.example.com", verificationStatus: "verified", isPrimary: true }],
    billingState: "active",
    publicRender: { checked: true, ok: true, status: 200 },
    content: {
      contactEnabled: true,
      contactEmailValid: true,
      galleryEnabled: true,
      galleryImageCount: 3,
      invalidConfiguredLinks: 0,
      checkedConfiguredLinks: 3,
      missingPublishableMedia: 0
    },
    storage: { publicBucketAvailable: true, privateBucketAvailable: true }
  });

  assert.ok(result.checks.some((check) => check.key === "contact" && check.status === "healthy"));
  assert.ok(result.checks.some((check) => check.key === "images" && check.status === "healthy"));
  assert.ok(result.checks.some((check) => check.key === "content_links" && check.status === "healthy"));
  assert.ok(result.checks.some((check) => check.key === "storage" && check.status === "healthy"));
});


test("reached standard AI quota is a guided usage action, not a platform incident", () => {
  const result = buildSupportDiagnosis({
    backendOk: true,
    site: { id: "site", slug: "demo", status: "published", publicAccessState: "live" },
    domains: [{ hostname: "demo.example.com", verificationStatus: "verified", isPrimary: true }],
    billingState: "active",
    publicRender: { checked: true, ok: true, status: 200 },
    ai: {
      enabled: true,
      heavyEnabled: true,
      quota: {
        planKey: "essential",
        subscriptionStatus: "active",
        betaActive: false,
        todayUsed: 20,
        dailyLimit: 20,
        monthUsed: 35,
        monthlyLimit: 80,
        heavyMonthUsed: 0,
        heavyMonthlyLimit: 0,
        launchOperationsRemaining: 0
      }
    }
  });
  const check = result.checks.find((item) => item.key === "ai");
  assert.equal(check?.status, "action");
  assert.match(check?.detail || "", /quot.*quotidien/i);
  assert.ok(check?.clientAction);
  assert.notEqual(result.overall, "incident");
});

test("reached Growth heavy quota leaves standard AI available", () => {
  const result = buildSupportDiagnosis({
    backendOk: true,
    site: { id: "site", slug: "demo", status: "published", publicAccessState: "live" },
    domains: [{ hostname: "demo.example.com", verificationStatus: "verified", isPrimary: true }],
    billingState: "active",
    publicRender: { checked: true, ok: true, status: 200 },
    ai: {
      enabled: true,
      heavyEnabled: true,
      quota: {
        planKey: "growth",
        subscriptionStatus: "active",
        betaActive: false,
        todayUsed: 2,
        dailyLimit: 100,
        monthUsed: 10,
        monthlyLimit: 500,
        heavyMonthUsed: 12,
        heavyMonthlyLimit: 12,
        launchOperationsRemaining: 0
      }
    }
  });
  const check = result.checks.find((item) => item.key === "ai");
  assert.equal(check?.status, "action");
  assert.match(check?.detail || "", /IA standard/);
  assert.match(check?.detail || "", /12\/12/);
});

test("healthy AI quota reports standard, heavy and AI Launch remaining capacity", () => {
  const result = buildSupportDiagnosis({
    backendOk: true,
    site: { id: "site", slug: "demo", status: "published", publicAccessState: "live" },
    domains: [{ hostname: "demo.example.com", verificationStatus: "verified", isPrimary: true }],
    billingState: "active",
    publicRender: { checked: true, ok: true, status: 200 },
    ai: {
      enabled: true,
      heavyEnabled: true,
      quota: {
        planKey: "growth",
        subscriptionStatus: "active",
        betaActive: false,
        todayUsed: 2,
        dailyLimit: 100,
        monthUsed: 10,
        monthlyLimit: 500,
        heavyMonthUsed: 3,
        heavyMonthlyLimit: 12,
        launchOperationsRemaining: 2
      }
    }
  });
  const check = result.checks.find((item) => item.key === "ai");
  assert.equal(check?.status, "healthy");
  assert.match(check?.detail || "", /10\/500/);
  assert.match(check?.detail || "", /3\/12/);
  assert.match(check?.detail || "", /2 opération/);
});
