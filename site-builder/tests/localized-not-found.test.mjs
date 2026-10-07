import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const notFound = fs.readFileSync(new URL("../app/not-found.tsx", import.meta.url), "utf8");

test("ELTARA app 404 is localized through the product locale", () => {
  assert.match(notFound, /useProductLocale/);
  assert.match(notFound, /tr\("Page introuvable", "Page not found"\)/);
  assert.match(notFound, /tr\("Retour à ELTARA", "Back to ELTARA"\)/);
  assert.match(notFound, /LanguageSwitch compact/);
  assert.doesNotMatch(notFound, /This page could not be found\./);
});

test("localized 404 keeps an explicit route back to ELTARA", () => {
  assert.match(notFound, /href=\{locale === "en" \? "\/\?lang=en" : "\/"\}/);
});
