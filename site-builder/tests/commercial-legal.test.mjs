import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const requiredRoutes = [
  "../app/mentions-legales/page.tsx",
  "../app/legal/page.tsx",
  "../app/confidentialite/page.tsx",
  "../app/privacy/page.tsx",
  "../app/cgv/page.tsx",
  "../app/terms/page.tsx",
  "../app/resilier/page.tsx",
  "../app/cancel/page.tsx"
];

test("commercial legal pages exist in French and English", () => {
  for (const route of requiredRoutes) {
    assert.equal(fs.existsSync(new URL(route, import.meta.url)), true, route);
  }
});

test("legal readiness cannot rely on a boolean flag alone", () => {
  const readiness = fs.readFileSync(
    new URL("../app/api/admin/release-readiness/route.ts", import.meta.url),
    "utf8"
  );
  assert.ok(readiness.includes("commercialLegalMissingFields.length === 0"));
  assert.ok(readiness.includes("AJG_COMMERCIAL_LEGAL_READY"));
});

test("seller identity and consumer gates are documented", () => {
  const env = fs.readFileSync(new URL("../.env.example", import.meta.url), "utf8");
  for (const key of [
    "AJG_LEGAL_NAME",
    "AJG_LEGAL_FORM",
    "AJG_LEGAL_ADDRESS",
    "AJG_LEGAL_EMAIL",
    "AJG_LEGAL_PHONE",
    "AJG_SIREN",
    "AJG_REGISTRATION",
    "AJG_PUBLICATION_DIRECTOR",
    "AJG_PRIVACY_EMAIL",
    "AJG_COMMERCIAL_CONSUMER_SALES_ENABLED",
    "AJG_CONSUMER_MEDIATOR_NAME"
  ]) assert.ok(env.includes(key), key);
});
