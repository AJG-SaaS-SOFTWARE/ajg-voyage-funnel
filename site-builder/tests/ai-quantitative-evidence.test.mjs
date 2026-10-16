import test from "node:test";
import assert from "node:assert/strict";
import { unsupportedQuantitativeClaims } from "../lib/ai-quantitative-evidence.ts";
import { standardQualityIssues } from "../lib/standard-ai-writer.ts";

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
