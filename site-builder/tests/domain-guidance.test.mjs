import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL("../lib/domain-guidance.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/domains/page.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const module = { exports: {} };
new Function("require", "module", "exports", code)(require, module, module.exports);
const { domainGuide } = module.exports;

test("domain guide starts with adding a domain when the plan allows it", () => {
  const steps = domainGuide({ customDomainAllowed: true, managedStatus: "verified", customStatus: null });
  assert.deepEqual(steps.map((step) => step.status), ["done", "current", "waiting"]);
});

test("domain guide moves the current step to DNS after a custom domain is registered", () => {
  const steps = domainGuide({ customDomainAllowed: true, managedStatus: "verified", customStatus: "pending" });
  assert.deepEqual(steps.map((step) => step.status), ["done", "done", "current"]);
  assert.match(steps[2].detailFr, /propagation/);
});

test("domain guide marks setup complete once DNS is verified", () => {
  const steps = domainGuide({ customDomainAllowed: true, managedStatus: "verified", customStatus: "verified" });
  assert.deepEqual(steps.map((step) => step.status), ["done", "done", "done"]);
});

test("domain guide does not encourage DNS changes before the feature is available", () => {
  const steps = domainGuide({ customDomainAllowed: false, managedStatus: "verified", customStatus: null });
  assert.equal(steps[1].status, "locked");
  assert.equal(steps[2].status, "locked");
});

test("domains page warns users to change only explicitly requested DNS records", () => {
  assert.match(page, /Ne modifiez pas d’autres enregistrements DNS/);
  assert.match(page, /Do not change DNS records other than those explicitly requested/);
});
