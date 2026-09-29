import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const purge = fs.readFileSync(
  new URL("../lib/privacy-purge.ts", import.meta.url),
  "utf8"
);
const route = fs.readFileSync(
  new URL("../app/api/admin/privacy-erasure/route.ts", import.meta.url),
  "utf8"
);
const adminPage = fs.readFileSync(
  new URL("../app/admin/privacy/page.tsx", import.meta.url),
  "utf8"
);

test("controlled purge removes Storage through the Storage API before deleting the site", () => {
  const storageCall = purge.indexOf(".storage.from(bucket).remove(batch)");
  const siteDelete = purge.indexOf('.from("sites")\n    .delete()');
  assert.ok(storageCall >= 0);
  assert.ok(siteDelete > storageCall);
  assert.ok(purge.includes("chunks(paths, 1000)"));
});

test("controlled purge cancels Stripe and detaches Vercel domains before database deletion", () => {
  const stripe = purge.indexOf("cancelSiteSubscription(service, site.id)");
  const vercel = purge.indexOf("await detachVercelDomain(domain.hostname)");
  const siteDelete = purge.indexOf('.from("sites")\n    .delete()');
  assert.ok(stripe >= 0);
  assert.ok(vercel > stripe);
  assert.ok(siteDelete > vercel);
});

test("GDPR purge removes off-provider media backups before completing site deletion", () => {
  const backupPurge = purge.indexOf("purgeStorageBackupForSite(ownerId, site.id)");
  const siteDelete = purge.indexOf('.from("sites")\n    .delete()');
  assert.ok(backupPurge >= 0);
  assert.ok(siteDelete > backupPurge);
  assert.ok(purge.includes("backup_objects_removed:"));
  assert.ok(purge.includes("backup_snapshots_rewritten:"));
});

test("site-scoped SET NULL traces are explicitly erased before the site row", () => {
  assert.ok(
    purge.includes(
      'for (const table of ["ai_provider_usage", "ai_usage_events", "user_feedback"])'
    )
  );
});

test("account purge blocks authentication then deletes the Supabase Auth user", () => {
  const ban = purge.indexOf("service.auth.admin.updateUserById(ownerId");
  const deletion = purge.indexOf("service.auth.admin.deleteUser(ownerId)");
  assert.ok(ban >= 0);
  assert.ok(deletion > ban);
});

test("admin purge requires admin authorization and exact PURGER confirmation", () => {
  assert.ok(route.includes('role?.role !== "admin"'));
  assert.ok(route.includes('confirmation !== "PURGER"'));
  assert.ok(route.includes('status: "processing"'));
  assert.ok(route.includes('status: "completed"'));
  assert.ok(route.includes("last_error"));
});

test("admin UI makes the irreversible confirmation explicit", () => {
  assert.ok(adminPage.includes("Cette purge est irréversible"));
  assert.ok(adminPage.includes('confirmation !== "PURGER"'));
  assert.ok(adminPage.includes("Reprendre la purge"));
});
