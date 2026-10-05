import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const api = readFileSync("app/api/admin/support/route.ts", "utf8");
const page = readFileSync("app/admin/support/page.tsx", "utf8");

test("admin support reports application, public-domain and managed-domain health", () => {
  assert.match(api, /resolveAny/);
  assert.match(api, /NEXT_PUBLIC_APP_URL/);
  assert.match(api, /NEXT_PUBLIC_PUBLISHED_ROOT_DOMAIN/);
  assert.match(api, /test-julien\.\$\{publishedRoot\}/);
  assert.match(api, /DNS externe à corriger/);
});

test("admin support renders platform DNS and HTTPS status before tickets", () => {
  assert.match(page, /État de santé de la plateforme/);
  assert.match(page, /NXDOMAIN/);
  assert.match(page, /sous-domaines clients/);
  assert.match(page, /Action requise/);
});
