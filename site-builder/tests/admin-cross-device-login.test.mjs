import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const adminLogin = fs.readFileSync(
  new URL("../app/admin/login/page.tsx", import.meta.url),
  "utf8"
);
const adminPage = fs.readFileSync(
  new URL("../app/admin/page.tsx", import.meta.url),
  "utf8"
);
const memberLogin = fs.readFileSync(
  new URL("../app/login/page.tsx", import.meta.url),
  "utf8"
);

test("admin login works on another device without creating a new account", () => {
  assert.match(adminLogin, /signInWithOtp/);
  assert.match(adminLogin, /shouldCreateUser:\s*false/);
  assert.match(adminLogin, /emailRedirectTo: window\.location\.origin \+ "\/admin"/);
  assert.match(adminLogin, /isCurrentUserAdmin/);
});

test("switching to admin clears any existing non-admin browser session first", () => {
  assert.match(adminLogin, /supabase\.auth\.signOut\(\)/);
  assert.match(adminLogin, /Un autre compte est actuellement connecté/);
  assert.match(adminLogin, /Rôle vérifié côté serveur/);
});

test("denied admin screen offers a direct account-switch path", () => {
  assert.match(adminPage, /href="\/admin\/login"/);
  assert.match(adminPage, /Se connecter \/ changer de compte administrateur/);
  assert.match(adminPage, /n’importe quel ordinateur ou/);
});

test("normal member login exposes the dedicated admin entry point", () => {
  assert.match(memberLogin, /href="\/admin\/login"/);
  assert.match(memberLogin, /Accès administrateur/);
});
