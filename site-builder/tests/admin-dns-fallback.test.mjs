import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("ELTARA keeps the stable Vercel app URL usable when custom DNS is unavailable", () => {
  const middleware = readFileSync("middleware.ts", "utf8");
  assert.match(
    middleware,
    /NEXT_PUBLIC_SITE_BUILDER_URL\|\|process\.env\.NEXT_PUBLIC_APP_URL\|\|"https:\/\/eltara\.ajgsolutionsgroup\.com"/
  );
  assert.match(middleware, /const legacyAppHostname="ajg-site-builder\.vercel\.app"/);
});

test("admin magic-link login remains origin-relative on the fallback host", () => {
  const login = readFileSync("app/admin/login/page.tsx", "utf8");
  assert.match(login, /emailRedirectTo: window\.location\.origin \+ "\/admin"/);
  assert.match(login, /shouldCreateUser:\s*false/);
});
