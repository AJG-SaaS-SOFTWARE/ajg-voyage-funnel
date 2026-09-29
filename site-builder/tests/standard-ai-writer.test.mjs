import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  normalizeStandardStructuredOutput,
  sanitizeStandardText,
  selectStandardContextEntries,
  standardStructuredFormat
} from "../lib/standard-ai-writer.ts";

test("guided and review flows use strict structured outputs", () => {
  const guided = standardStructuredFormat("guidedDraft");
  const review = standardStructuredFormat("qualityReview");
  assert.equal(guided?.type, "json_schema");
  assert.equal(guided?.strict, true);
  assert.equal(review?.type, "json_schema");
  assert.equal(review?.strict, true);
});

test("quality review normalization returns only supported editable fields", () => {
  const normalized = normalizeStandardStructuredOutput("qualityReview", "", {
    issues: [
      { field: "heroTitle", reason: "Titre trop vague." },
      { field: "unknown", reason: "Ne doit pas passer." }
    ],
    suggestions: [
      { field: "heroTitle", text: "**Un titre plus précis**" },
      { field: "unknown", text: "À ignorer" }
    ]
  });

  assert.deepEqual(normalized.issues, [
    { field: "heroTitle", reason: "Titre trop vague." }
  ]);
  assert.deepEqual(normalized.suggestions, {
    heroTitle: "Un titre plus précis"
  });
});

test("plain field suggestions are insertion-ready and respect field limits", () => {
  const title = sanitizeStandardText(
    "heroTitle",
    '"## **Un titre clair et humain pour présenter une activité locale avec beaucoup trop de mots inutiles qui dépassent nettement la longueur prévue**"'
  );
  assert.ok(title.length <= 90);
  assert.ok(!title.includes("**"));
  assert.ok(!title.includes("##"));
  assert.ok(!title.startsWith('"'));
});

test("figures drafts never keep model-generated numeric values", () => {
  const normalized = normalizeStandardStructuredOutput("moduleDraft", "figures", {
    title: "Quelques repères",
    items: [
      { value: "42", label: "Projets accompagnés" },
      { value: "99 %", label: "Satisfaction" }
    ]
  });
  assert.deepEqual(normalized.draft.items, [
    { value: "", label: "Projets accompagnés" },
    { value: "", label: "Satisfaction" }
  ]);
});

test("guided builder discovery is activity-agnostic instead of travel-specific", () => {
  const source = fs.readFileSync(
    new URL("../app/builder/page.tsx", import.meta.url),
    "utf8"
  );
  assert.ok(source.includes("Que proposez-vous ou quelle est votre activité ?"));
  assert.ok(source.includes("Qu'est-ce qui caractérise votre approche ?"));
  assert.ok(source.includes("Que voulez-vous que le visiteur comprenne ou fasse ?"));
  assert.ok(!source.includes("Quel type de voyageur êtes-vous ?"));
});

test("field context ranking prioritizes discovery facts over incidental existing copy", () => {
  const entries = [
    ["tagline", "Une ancienne accroche"],
    ["headline", "Un ancien titre"],
    ["intro", "Une ancienne introduction"],
    ["about", "Un ancien texte à propos"],
    ["booking button", "Contactez-moi"],
    ["activity or offer", "Photographie de famille et de couple"],
    ["differentiation or approach", "Approche naturelle et peu posée"],
    ["visitor goal", "Rassurer puis donner envie de prendre contact"],
    ["audience", "Familles et couples"]
  ];

  const selected = selectStandardContextEntries("heroTitle", entries);
  assert.deepEqual(
    selected.slice(0, 4).map(([key]) => key),
    [
      "activity or offer",
      "differentiation or approach",
      "visitor goal",
      "audience"
    ]
  );
});

test("CTA context starts from the visitor goal and stays compact", () => {
  const entries = [
    ["headline", "Un titre"],
    ["intro", "Une intro"],
    ["about", "À propos"],
    ["activity or offer", "Coaching sportif"],
    ["differentiation or approach", "Suivi progressif"],
    ["visitor goal", "Réserver un appel découverte"],
    ["audience", "Coureurs débutants"]
  ];

  const selected = selectStandardContextEntries("bookingLabel", entries);
  assert.equal(selected[0][0], "visitor goal");
  assert.ok(selected.length <= 7);
});

test("module drafting prioritizes the explicit module brief", () => {
  const entries = [
    ["headline", "Titre"],
    ["activity or offer", "Conseil en organisation"],
    ["module brief", "Répondre aux objections fréquentes avant la prise de contact"]
  ];

  const selected = selectStandardContextEntries("moduleDraft", entries);
  assert.equal(selected[0][0], "module brief");
});

