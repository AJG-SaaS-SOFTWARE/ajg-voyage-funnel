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
const layout = fs.readFileSync(
  new URL("../app/layout.tsx", import.meta.url),
  "utf8"
);

test("pricing content declares its page language", () => {
  assert.ok(pricing.includes('lang={locale}'));
  assert.ok(pricing.includes('hrefLang={locale === "fr" ? "en" : "fr"}'));
});

test("pricing routes expose reciprocal language alternates", () => {
  assert.ok(pricingEn.includes("canonical: `${base}/pricing`"));
  assert.ok(pricingEn.includes('fr: `${base}/tarifs`'));
  assert.ok(pricingFr.includes("canonical: `${base}/tarifs`"));
  assert.ok(pricingFr.includes('en: `${base}/pricing`'));
});

test("middleware forwards explicit pricing locale and returns matching HTTP content language", () => {
  assert.ok(middleware.includes('pathname==="/pricing"?"en"'));
  assert.ok(middleware.includes('pathname==="/tarifs"?"fr"'));
  assert.ok(middleware.includes('requestHeaders.set("x-ajg-product-locale",explicitLocale)'));
  assert.ok(middleware.includes('NextResponse.next({request:{headers:requestHeaders}})'));
  assert.ok(middleware.includes('response.headers.set("Content-Language",explicitLocale)'));
});

test("root layout prioritizes explicit pricing locale over cookie and browser language", () => {
  assert.ok(layout.includes('headerStore.get("x-ajg-product-locale")'));
  assert.ok(layout.includes('explicitLocale === "en" || explicitLocale === "fr"'));
  assert.ok(
    layout.indexOf('explicitLocale === "en" || explicitLocale === "fr"') <
      layout.indexOf('cookieLocale === "en" || cookieLocale === "fr"')
  );
});
