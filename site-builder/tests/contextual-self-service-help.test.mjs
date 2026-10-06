import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL("../lib/customer-error-guidance.ts", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../components/AccountShell.tsx", import.meta.url), "utf8");
const support = fs.readFileSync(new URL("../app/support/page.tsx", import.meta.url), "utf8");
const domains = fs.readFileSync(new URL("../app/domains/page.tsx", import.meta.url), "utf8");
const data = fs.readFileSync(new URL("../app/data/page.tsx", import.meta.url), "utf8");

const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const module = { exports: {} };
new Function("require", "module", "exports", code)(require, module, module.exports);
const { explainCustomerError } = module.exports;

test("customer error guidance routes recurring failures to a concrete next action", () => {
  assert.equal(explainCustomerError("Vérification DNS impossible").href, "/domains");
  assert.equal(explainCustomerError("Votre quota de stockage est atteint").href, "/plans");
  assert.equal(explainCustomerError("Reconnectez-vous pour continuer").href, "/login");
  assert.equal(explainCustomerError("Export impossible").href, "/data");
  assert.equal(explainCustomerError("Une erreur inattendue est survenue").href, "/support");
});

test("account screens expose contextual support links", () => {
  assert.match(shell, /account-context-help/);
  assert.match(shell, /\/support\?topic=/);
  assert.match(shell, /Aide liée à cet écran/);
  assert.match(shell, /Help for this screen/);
});

test("support center filters its knowledge base from the originating screen", () => {
  assert.match(support, /URLSearchParams\(window\.location\.search\)/);
  assert.match(support, /article\.category === topic/);
  assert.match(support, /Voir toute la base de connaissances/);
});

test("domain and data flows display deterministic actionable error help", () => {
  assert.match(domains, /CustomerErrorHelp/);
  assert.match(data, /CustomerErrorHelp/);
});
