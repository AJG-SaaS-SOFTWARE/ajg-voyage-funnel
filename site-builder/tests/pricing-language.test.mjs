import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const pricing = fs.readFileSync(
  new URL("../components/PricingPage.tsx", import.meta.url),
  "utf8"
);
const pricingEn = fs.readFileSync(
  new URL("../app/pricing/page.tsx", import.meta.url),
  "utf8"
);
const pricingFr = fs.readFileSync(
  new URL("../app/tarifs/page.tsx", import.meta.url),
  "utf8"
);
const middleware = fs.readFileSync(
  new URL("../middleware.ts", import.meta.url),
  "utf8"
);

test("pricing content declares its page language", () => {
  assert.ok(pricing.includes('lang={locale}'));
  assert.ok(pricing.includes('hrefLang={locale === "fr" ? "en" : "fr"}'));
});

test("pricing routes expose reciprocal language alternates", () => {
  assert.ok(pricingEn.includes('canonical: new URL("/pricing", siteUrl)'));
  assert.ok(pricingEn.includes('fr: new URL("/tarifs", siteUrl)'));
  assert.ok(pricingFr.includes('canonical: new URL("/tarifs", siteUrl)'));
  assert.ok(pricingFr.includes('en: new URL("/pricing", siteUrl)'));
});

test("middleware returns HTTP content language for public pricing routes", () => {
  assert.ok(middleware.includes('pathname==="/pricing"'));
  assert.ok(middleware.includes('set("Content-Language","en")'));
  assert.ok(middleware.includes('pathname==="/tarifs"'));
  assert.ok(middleware.includes('set("Content-Language","fr")'));
});
