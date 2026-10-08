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

test("mirrored Builder E2E propagates the selected locale to the AI route", () => {
  assert.match(route, /"X-AJG-Locale": locale/);
  assert.match(route, /new URL\("\/api\/ai\/write", request\.url\)/);
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

test("mirrored E2E exposes the complete commercial-language journey without opening Checkout", () => {
  for (const key of ["auth", "create", "billing", "ai", "media", "publish", "domains", "public", "republish", "feedback", "data", "cleanup"]) {
    assert.match(route, new RegExp(`key: "${key}"`));
  }
  assert.match(route, /Managed domain readback failed/);
  assert.match(route, /verification_status !== "verified"/);
  assert.match(route, /Archive TAR\.GZ réelle générée avec succès/);
  assert.match(route, /sans ouvrir Checkout/);
  assert.doesNotMatch(route, /\/api\/billing\/checkout/);
});

test("E2E performs a real second publish and validates updated public content", () => {
  assert.match(route, /currentStage = "republish"/);
  assert.match(route, /Mise à jour E2E/);
  assert.match(route, /E2E update/);
  assert.match(route, /hero_title: republishMarker/);
  assert.match(route, /republishedHtml\.includes\(republishMarker\)/);
  assert.match(route, /key: "republish"/);
  assert.match(route, /Republish validation returned HTTP/);
});

test("mirrored E2E only reports parity after both isolated runs succeeded", () => {
  assert.match(page, /builderE2EMirrorResults\?\.length === 2/);
  assert.match(page, /builderE2EMirrorResults\.map\(\(result\) =>/);
  assert.match(page, /Création, IA, média, publication, rendu public, feedback, export et nettoyage terminés\./);
  assert.match(route, /key: "billing"/);
  assert.match(route, /key: "domains"/);
  assert.match(route, /key: "data"/);
});


test("disposable Builder E2E satisfies the first-paid cost gate without opening Checkout", () => {
  assert.match(route, /first_payment_confirmed_at: new Date\(\)\.toISOString\(\)/);
  assert.match(route, /provider: "internal-e2e"/);
  assert.match(route, /état Growth payé interne/);
  assert.doesNotMatch(route, /\/api\/billing\/checkout/);
  assert.doesNotMatch(route, /AJG_BILLING_CHECKOUT_ENABLED/);
  assert.doesNotMatch(route, /AJG_COMMERCIAL_(?:LEGAL|TAX)_READY/);
});
