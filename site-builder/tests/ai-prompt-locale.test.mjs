import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("app/api/ai/write/route.ts", "utf8");

test("standard AI prompts select English field metadata for English generations", () => {
  assert.match(source, /const englishWritableFields:/);
  assert.match(source, /language === "English"/);
  assert.match(source, /\.\.\.englishWritableFields\[field\]/);
  assert.match(source, /Field to write: \$\{localizedFieldSpec\.name\}/);
  assert.match(source, /Hard constraint: \$\{localizedFieldSpec\.constraint\}/);
  assert.doesNotMatch(source, /Field to write: \$\{fieldSpec\.name\}/);
  assert.doesNotMatch(source, /Hard constraint: \$\{fieldSpec\.constraint\}/);
});

test("every standard writable field has explicit English prompt metadata", () => {
  for (const key of [
    "heroTagline",
    "heroTitle",
    "heroSubtitle",
    "aboutHeading",
    "aboutText",
    "guidedDraft",
    "qualityReview",
    "siteRevision",
    "siteArchitect",
    "moduleDraft",
    "bookingLabel"
  ]) {
    assert.match(source, new RegExp(key + ": \\{"));
  }

  assert.match(source, /name: "the main homepage headline"/);
  assert.match(source, /name: "the personal introduction"/);
  assert.match(source, /name: "the booking button label"/);
  assert.match(source, /maximum 45 characters/);
});
