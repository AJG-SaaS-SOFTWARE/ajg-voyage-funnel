import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("scripts/verify-deployment.mjs", "utf8");

test("deployment verifier checks both public pricing locales on the final canonical page", () => {
  assert.match(source, /verifyLocalizedPage\("\/tarifs"/);
  assert.match(source, /locale: "fr"/);
  assert.match(source, /title: "Créez\. Gérez\. Faites progresser\."/);
  assert.match(source, /legalHref: "\/mentions-legales"/);

  assert.match(source, /verifyLocalizedPage\("\/pricing"/);
  assert.match(source, /locale: "en"/);
  assert.match(source, /title: "Build\. Run\. Grow\."/);
  assert.match(source, /legalHref: "\/legal"/);
});

test("deployment locale smoke validates server language, html language and localized legal navigation", () => {
  assert.match(source, /content-language/);
  assert.match(source, /expected Content-Language/);
  assert.match(source, /<html lang=/);
  assert.match(source, /expected localized title/);
  assert.match(source, /expected localized legal link/);
});

test("deployment locale smoke follows only the validated ELTARA canonical host", () => {
  assert.match(source, /redirected\.hostname !== "eltara\.ajgsolutionsgroup\.com"/);
  assert.match(source, /new URL\(path, "https:\/\/eltara\.ajgsolutionsgroup\.com"\)/);
  assert.match(source, /canonical ELTARA page expected 200/);
});


test("deployment verifier checks visible 404 copy in both product locales", () => {
  assert.match(source, /verifyLocalizedNotFound\("fr", "Page introuvable"\)/);
  assert.match(source, /verifyLocalizedNotFound\("en", "Page not found"\)/);
  assert.match(source, /"Accept-Language": locale === "en"/);
  assert.match(source, /native English Next\.js fallback leaked into French rendering/);
});
