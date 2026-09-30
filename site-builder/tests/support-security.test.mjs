import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(new URL("../supabase/migrations/20260930211500_support_health_center.sql", import.meta.url), "utf8");
const clientRoute = fs.readFileSync(new URL("../app/api/support/tickets/route.ts", import.meta.url), "utf8");
const adminRoute = fs.readFileSync(new URL("../app/api/admin/support/route.ts", import.meta.url), "utf8");

test("support tickets cannot be written directly by browser roles", () => {
  assert.match(migration, /revoke insert, update, delete on public\.support_tickets from authenticated/i);
  assert.match(migration, /user_id=\(select auth\.uid\(\)\)/i);
  assert.match(migration, /enable row level security/i);
});

test("ticket creation authenticates first and scopes diagnostics to the authenticated owner", () => {
  assert.match(clientRoute, /auth\.getUser\(token\)/);
  assert.match(clientRoute, /\.eq\("owner_id", userId\)/);
  assert.match(clientRoute, /\.from\("support_tickets"\)\s*\.insert/);
});

test("admin support changes require a database admin role", () => {
  assert.match(adminRoute, /\.from\("user_roles"\)/);
  assert.match(adminRoute, /role\?\.role !== "admin"/);
  assert.match(adminRoute, /export async function PATCH/);
});


test("support ticket creation is rate limited server-side", () => {
  assert.match(clientRoute, /recentCount/);
  assert.match(clientRoute, /openCount/);
  assert.match(clientRoute, /status: 429/);
});


test("public rendering probe uses the configured Builder origin rather than a client supplied host", () => {
  assert.match(clientRoute, /appBaseUrl\(\)/);
  assert.doesNotMatch(clientRoute, /new URL\(request\.url\)\.origin/);
  assert.match(clientRoute, /AbortController/);
});
