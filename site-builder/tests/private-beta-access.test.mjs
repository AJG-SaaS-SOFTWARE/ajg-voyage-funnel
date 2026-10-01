import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const login = fs.readFileSync(new URL("../app/login/page.tsx", import.meta.url), "utf8");
const builder = fs.readFileSync(new URL("../app/builder/page.tsx", import.meta.url), "utf8");
const access = fs.readFileSync(new URL("../lib/private-beta-access.ts", import.meta.url), "utf8");
const denied = fs.readFileSync(new URL("../app/beta-access/page.tsx", import.meta.url), "utf8");

test("private beta login cannot create arbitrary Supabase users", () => {
  assert.match(login, /shouldCreateUser:\s*false/);
  assert.match(login, /Bêta privée · sur invitation/);
  assert.match(login, /getPrivateBetaAccess/);
});

test("Builder admits only active Beta Testers or admins", () => {
  assert.match(access, /betaActive \|\| admin/);
  assert.match(access, /get_my_beta_access/);
  assert.match(access, /from\("user_roles"\)/);
  assert.match(builder, /getPrivateBetaAccess\(\)/);
  assert.match(builder, /router\.replace\("\/beta-access"\)/);
});

test("denied existing accounts keep their data and can switch account", () => {
  assert.match(denied, /Aucun site ni aucune donnée du compte n’est supprimé/);
  assert.match(denied, /signOut/);
  assert.match(denied, /\/login/);
});
