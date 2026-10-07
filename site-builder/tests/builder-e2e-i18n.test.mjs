import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(
  new URL("../app/api/admin/builder-e2e/route.ts", import.meta.url),
  "utf8"
);
const admin = fs.readFileSync(
  new URL("../lib/admin.ts", import.meta.url),
  "utf8"
);
const page = fs.readFileSync(
  new URL("../app/admin/page.tsx", import.meta.url),
  "utf8"
);

test("authenticated Builder E2E accepts an explicit FR or EN locale", () => {
  assert.match(route, /body\?\.locale === "en" \? "en" : "fr"/);
  assert.match(route, /primary_language: locale/);
  assert.match(route, /enabled_languages: \[locale\]/);
  assert.match(route, /language: locale/);
  assert.match(route, /locale,/);
});

test("authenticated Builder E2E localizes temporary content and public validation", () => {
  assert.match(route, /Temporary ELTARA technical validation website/);
  assert.match(route, /Site temporaire de validation technique ELTARA/);
  assert.match(route, /tr\("Accueil", "Home"\)/);
  assert.match(route, /expectedPublicText = locale === "en"/);
  assert.match(route, /expected \$\{locale\.toUpperCase\(\)\} content/);
});

test("admin client and UI expose FR and EN E2E selection", () => {
  assert.match(admin, /locale: "fr" \| "en"/);
  assert.match(admin, /JSON\.stringify\(\{ includeAi, locale \}\)/);
  assert.match(page, /builderE2ELocale/);
  assert.match(page, /<option value="fr">Français<\/option>/);
  assert.match(page, /<option value="en">English<\/option>/);
  assert.match(page, /adminRunBuilderE2E\(true, builderE2ELocale\)/);
});


test("admin UI can run the full authenticated Builder E2E sequentially in both locales", () => {
  assert.match(page, /const runBuilderE2EMirror = async \(\) =>/);
  assert.match(page, /const fr = await adminRunBuilderE2E\(true, "fr"\)/);
  assert.match(page, /const en = await adminRunBuilderE2E\(true, "en"\)/);
  assert.match(page, /setBuilderE2EMirrorResults\(\[fr, en\]\)/);
  assert.match(page, /Valider FR \+ EN/);
  assert.match(page, /Parité E2E FR \+ EN validée ✓/);
  assert.match(page, /la validation miroir en consomme deux/);
});

test("mirrored E2E only reports parity after both isolated runs succeeded", () => {
  assert.match(page, /builderE2EMirrorResults\?\.length === 2/);
  assert.match(page, /builderE2EMirrorResults\.map\(\(result\) =>/);
  assert.match(page, /Création, IA, média, publication, rendu public, feedback, export et nettoyage terminés\./);
});
