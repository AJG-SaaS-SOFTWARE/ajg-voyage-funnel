import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL("../lib/support-guidance.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/support/page.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const module = { exports: {} };
new Function("require", "module", "exports", code)(require, module, module.exports);
const { supportGuidanceForDiagnosis } = module.exports;

test("contextual support guidance only includes non-healthy diagnostic checks", () => {
  const rows = supportGuidanceForDiagnosis([
    { key: "domain", label: "Domaine", status: "action", detail: "pending" },
    { key: "billing", label: "Facturation", status: "healthy", detail: "ok" }
  ], "fr");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].key, "domain");
  assert.equal(rows[0].href, "/domains");
});

test("contextual support guidance is bilingual and bounded", () => {
  const checks = ["domain","billing","ai","contact","images","content_links"].map((key) => ({
    key, label: key, status: "action", detail: "x"
  }));
  const rows = supportGuidanceForDiagnosis(checks, "en");
  assert.equal(rows.length, 4);
  assert.match(rows[0].why, /domain|subdomain/i);
});

test("support page explains that contextual guidance does not send content to AI", () => {
  assert.match(page, /Aucun contenu de votre site ou de votre demande n’est envoyé à une IA/);
  assert.match(page, /No website or request content is sent to an AI/);
  assert.match(page, /supportGuidanceForDiagnosis/);
});
