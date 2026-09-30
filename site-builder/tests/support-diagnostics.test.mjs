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
    billingState: "active"
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
