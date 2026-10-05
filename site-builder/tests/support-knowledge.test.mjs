import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL("../lib/support-knowledge.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/support/page.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const module = { exports: {} };
new Function("require", "module", "exports", code)(require, module, module.exports);
const { supportKnowledgeBase, supportArticlesForLocale } = module.exports;

test("support knowledge covers the five recurring self-service domains", () => {
  assert.deepEqual(
    [...new Set(supportKnowledgeBase.map(article => article.category))].sort(),
    ["ai","billing","data","domain","publishing"]
  );
});

test("every support article is bilingual, actionable and linked to an ELTARA screen", () => {
  for (const article of supportKnowledgeBase) {
    assert.ok(article.titleFr && article.titleEn);
    assert.ok(article.summaryFr && article.summaryEn);
    assert.ok(article.stepsFr.length >= 2 && article.stepsEn.length >= 2);
    assert.match(article.href, /^\//);
  }
});

test("locale projection never mixes French and English steps", () => {
  const fr = supportArticlesForLocale("fr");
  const en = supportArticlesForLocale("en");
  assert.equal(fr.length, en.length);
  assert.notEqual(fr[0].title, en[0].title);
  assert.deepEqual(fr[0].steps, supportKnowledgeBase[0].stepsFr);
  assert.deepEqual(en[0].steps, supportKnowledgeBase[0].stepsEn);
});

test("Support Center renders the knowledge base without an LLM dependency", () => {
  assert.match(page, /Base de connaissances/);
  assert.match(page, /Knowledge base/);
  assert.match(page, /supportArticlesForLocale/);
  assert.doesNotMatch(source, /openai|anthropic|llm/i);
});
