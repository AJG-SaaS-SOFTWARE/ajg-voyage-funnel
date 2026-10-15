import test from "node:test";
import assert from "node:assert/strict";
import { hasHtmlMarkup, hasMarkdownMarkup } from "../lib/ai-presentation-markup.ts";
import { standardQualityIssues } from "../lib/standard-ai-writer.ts";

test("real presentation tags are detected independently in every field", () => {
  for (const text of ["<strong>Atelier</strong>", "<P class='intro'>Bienvenue</P>", "Bonjour<br/>à tous",
    "<span>Contact</span>", "<a href='https://example.test'>Contact</a>", "<ul><li>Service</li></ul>",
    "<div\nclass='intro'>Texte</div>", "<img src='portrait.jpg' />", "<script>alert(1)</script>"]) {
    assert.equal(hasHtmlMarkup(text), true, text);
    assert.equal(hasHtmlMarkup(text), true, "consecutive check: " + text);
    assert.ok(standardQualityIssues("heroTitle", "", text).some(issue => issue.code === "presentation_markup"), text);
  }
});

test("contact addresses, autolinks and ordinary comparisons are legitimate plain text", () => {
  for (const text of ["Contact <a@example.test>", "Écrivez à <p@example.test>", "<i@example.test>",
    "<b@example.test>", "<em@example.test>", "Visitez <https://example.test/service>",
    "a < b et b > c", "Prix < 50 euros", "Une page sans balise"]) {
    assert.equal(hasHtmlMarkup(text), false, text);
    assert.equal(hasMarkdownMarkup(text), false, text);
    assert.equal(standardQualityIssues("heroTitle", "", text, text).some(issue => issue.code === "presentation_markup"), false, text);
  }
});

test("Markdown remains detected without confusing ordinary URLs and punctuation", () => {
  for (const text of ["**Atelier**", "__Atelier__", "# Bienvenue", "```html\ntexte\n```", "[Contact](https://example.test)"]) {
    assert.equal(hasMarkdownMarkup(text), true, text);
    assert.equal(hasMarkdownMarkup(text), true, text);
  }
  for (const text of ["Atelier : clair et simple", "https://example.test/a_b", "Écrivez-nous !"]) {
    assert.equal(hasMarkdownMarkup(text), false, text);
  }
});

test("structured assistance checks each visible FAQ question and answer", () => {
  const issues = standardQualityIssues("moduleDraft", "faq", { draft: { title: "FAQ", items: [
    { question: "<b>Comment venir ?</b>", answer: "<p>Sur rendez-vous.</p>" },
    { question: "Comment écrire ?", answer: "Contact <a@example.test>" }
  ] } });
  const markup = issues.filter(issue => issue.code === "presentation_markup");
  assert.equal(markup.length, 2);
  assert.ok(markup.some(issue => issue.detail.startsWith("faq-question-1")));
  assert.ok(markup.some(issue => issue.detail.startsWith("faq-answer-1")));
});
