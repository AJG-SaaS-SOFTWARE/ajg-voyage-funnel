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

test("grouped thousands match their ungrouped equivalent without authorizing a suffix", () => {
  for (const separator of [" ", "\u00a0", "\u202f"]) {
    const evidence = `Prix : 1${separator}500 € et 25${separator}000 clients.`;
    assert.deepEqual(unsupportedQuantitativeClaims("1500 euros pour 25000 customers.", evidence), []);
    assert.deepEqual(unsupportedQuantitativeClaims("500 € pour 000 clients.", evidence), ["500 €", "000 clients"]);
    assert.deepEqual(unsupportedQuantitativeClaims(`1${separator}500 €`, "Prix : 1500 euros."), []);
  }
});

test("currency prefixes and grouped decimals preserve the full monetary amount", () => {
  assert.deepEqual(unsupportedQuantitativeClaims("$1 250.50", "1250,50 USD"), []);
  assert.deepEqual(unsupportedQuantitativeClaims("€1\u202f250,50", "1250.50 euros"), []);
  assert.deepEqual(unsupportedQuantitativeClaims("250,50 €", "1 250,50 euros"), ["250,50 €"]);
  assert.deepEqual(unsupportedQuantitativeClaims("1250,50 dollars", "1 250,50 euros"), ["1250,50 dollars"]);
});

test("multiple thousands groups remain one value and retain the unit", () => {
  assert.deepEqual(unsupportedQuantitativeClaims("1 250 000 projets", "1250000 projects"), []);
  assert.deepEqual(unsupportedQuantitativeClaims("250 000 projets", "1 250 000 projets"), ["250 000 projets"]);
  assert.deepEqual(unsupportedQuantitativeClaims("1250000 clients", "1 250 000 projets"), ["1250000 clients"]);
});

test("calendar years, availability and ordinary decimals keep their existing grounding", () => {
  assert.deepEqual(unsupportedQuantitativeClaims("Depuis 2020, disponibles 24/7, réponse en 1,5 heure.", "Depuis 2020, 24 / 7, réponse en 1.5 hours."), []);
  assert.deepEqual(unsupportedQuantitativeClaims("Réponse en 1,5 jour.", "Réponse en 1,5 heure."), ["1,5 jour"]);
});

test("assistance rejects suffix amounts and accepts equivalent grouped source amounts", () => {
  const issues = text => standardQualityIssues("aboutText", "", text, "Une prestation à 1 500 euros.");
  assert.ok(issues("Une prestation à 500 euros.").some(issue => issue.code === "unsupported_quantitative_claim"));
  assert.ok(!issues("Une prestation à 1500 €.").some(issue => issue.code === "unsupported_quantitative_claim"));
});
