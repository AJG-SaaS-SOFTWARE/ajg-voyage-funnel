import test from "node:test";
import assert from "node:assert/strict";
import { unsupportedQuantitativeClaims } from "../lib/ai-quantitative-evidence.ts";
import { standardQualityIssues, selectStandardContextEntries } from "../lib/standard-ai-writer.ts";

test("same number with another unit cannot ground an invented claim", () => {
  assert.deepEqual(unsupportedQuantitativeClaims("20 clients", "20 ans d'expérience"), ["20 clients"]);
  assert.deepEqual(unsupportedQuantitativeClaims("90 %", "Une séance de 90 minutes"), ["90 %"]);
  assert.deepEqual(unsupportedQuantitativeClaims("49 euros", "49 projets"), ["49 euros"]);
});

test("FR/EN units, currency position and decimal notation retain supplied facts", () => {
  for (const [output, evidence] of [
    ["20 customers", "20 clients"], ["2 years", "2 années"],
    ["49 €", "€49"], ["49 euros", "€49"],
    ["14.90 euros", "14,90 €"], ["90 minutes", "90 mins"],
    ["3 months", "3 mois"], ["2 days", "2 jours"],
    ["5 bookings", "5 réservations"], ["2026", "Depuis 2026"]
  ]) assert.deepEqual(unsupportedQuantitativeClaims(output, evidence), []);
});

test("currencies and numeric values are distinct", () => {
  assert.deepEqual(unsupportedQuantitativeClaims("49 dollars", "49 euros"), ["49 dollars"]);
  assert.deepEqual(unsupportedQuantitativeClaims("50 clients", "49 clients"), ["50 clients"]);
});

test("availability 24/7 requires the whole supplied claim", () => {
  assert.deepEqual(unsupportedQuantitativeClaims("Disponible 24/7", "24 clients, 7 ans"), ["24/7"]);
  assert.deepEqual(unsupportedQuantitativeClaims("Disponible 24/7", "Disponible 24 / 7"), []);
});

test("standard writing guard applies unit-aware grounding", () => {
  const issues = standardQualityIssues("heroSubtitle", "", "20 clients accompagnés", "20 ans d'expérience");
  assert.ok(issues.some(x => x.code === "unsupported_quantitative_claim"));
});

test("about rewriting keeps its existing factual text even with a full discovery context", () => {
  const entries = ["activity or offer", "differentiation or approach", "visitor goal", "audience", "headline", "intro", "about heading", "about"].map(key => [key, key === "about" ? "Parcours personnel fourni par le client" : key]);
  for (const field of ["aboutHeading", "aboutText"]) {
    const selected = selectStandardContextEntries(field, entries);
    assert.ok(selected.some(([key]) => key === "about"));
    assert.ok(selected.length <= 7);
  }
});
