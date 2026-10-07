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
const {
  supportCheckDisplay,
  supportGuidanceForDiagnosis,
  supportTicketStatusLabel
} = module.exports;

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


test("Support display keeps rich French diagnostics and localizes English presentation", () => {
  const check = {
    key: "domain",
    label: "Domaine",
    status: "action",
    detail: "exemple.fr est encore en attente de vérification DNS.",
    clientAction: "Vérifiez les DNS indiqués."
  };

  assert.deepEqual(supportCheckDisplay(check, "fr"), {
    title: "Domaine",
    detail: "exemple.fr est encore en attente de vérification DNS.",
    action: "Vérifiez les DNS indiqués."
  });

  const english = supportCheckDisplay(check, "en");
  assert.equal(english.title, "Domain");
  assert.match(english.detail, /domain|subdomain/i);
  assert.match(english.action, /Domains|DNS/i);
  assert.doesNotMatch(english.detail, /attente|vérification/);
});

test("Support ticket statuses are customer-facing in both locales", () => {
  assert.equal(supportTicketStatusLabel("waiting_customer", "fr"), "Action requise");
  assert.equal(supportTicketStatusLabel("waiting_customer", "en"), "Action required");
  assert.equal(supportTicketStatusLabel("resolved", "fr"), "Résolu");
  assert.equal(supportTicketStatusLabel("resolved", "en"), "Resolved");
  assert.equal(supportTicketStatusLabel("unexpected", "en"), "In review");
});

test("Support page never renders raw technical ticket status or raw French action in English", () => {
  assert.match(page, /supportTicketStatusLabel\(ticket\.status, locale\)/);
  assert.match(page, /supportCheckDisplay\(check, locale\)/);
  assert.match(page, /locale === "en"/);
  assert.doesNotMatch(page, /<strong>\{ticket\.subject\}<\/strong> · \{ticket\.status\}/);
});
