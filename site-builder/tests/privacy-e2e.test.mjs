import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(
  new URL("../app/api/admin/privacy-e2e/route.ts", import.meta.url),
  "utf8"
);

test("privacy E2E uses only a generated disposable auth user", () => {
  assert.ok(route.includes("privacy-e2e-"));
  assert.ok(route.includes("service.auth.admin.createUser"));
  assert.ok(route.includes("user_metadata: { purpose: \"ajg_privacy_e2e\" }"));
});

test("privacy E2E exercises the real account-erasure request and admin purge route", () => {
  assert.ok(route.includes('"request_builder_account_erasure"'));
  assert.ok(route.includes('new URL("/api/admin/privacy-erasure", request.url)'));
  assert.ok(route.includes('confirmation: "PURGER"'));
});

test("privacy E2E verifies site, storage, auth and pseudonymized audit cleanup", () => {
  assert.ok(route.includes("site_residue_detected"));
  assert.ok(route.includes("storage_residue_detected"));
  assert.ok(route.includes("auth_user_residue_detected"));
  assert.ok(route.includes("erasure_audit_not_pseudonymized"));
  assert.ok(route.includes('requestRow.user_id !== null'));
  assert.ok(route.includes('requestRow.site_id !== null'));
});

test("privacy E2E has best-effort cleanup scoped to the disposable user", () => {
  assert.ok(route.includes("generated disposable user"));
  assert.ok(route.includes('.eq("owner_id", testUserId)'));
  assert.ok(route.includes("service.auth.admin.deleteUser(testUserId)"));
});
