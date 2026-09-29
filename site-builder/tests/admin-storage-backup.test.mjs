import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(
  new URL("../app/api/admin/storage-backup/route.ts", import.meta.url),
  "utf8"
);
const admin = fs.readFileSync(
  new URL("../app/admin/page.tsx", import.meta.url),
  "utf8"
);

test("manual backup endpoint requires an authenticated admin role", () => {
  assert.ok(route.includes('value.startsWith("Bearer ")'));
  assert.ok(route.includes('.from("user_roles")'));
  assert.ok(route.includes('role?.role !== "admin"'));
});

test("manual backup endpoint reuses the production backup engine", () => {
  assert.ok(route.includes("getStorageBackupStatus"));
  assert.ok(route.includes("runStorageBackup"));
  assert.ok(!route.includes("CRON_SECRET"));
});

test("admin UI disables manual backup until the private store is configured", () => {
  assert.ok(admin.includes("backupStatus?.configured !== true"));
  assert.ok(admin.includes("Lancer une sauvegarde maintenant"));
  assert.ok(admin.includes("Connectez d’abord le store Vercel Blob privé"));
});
