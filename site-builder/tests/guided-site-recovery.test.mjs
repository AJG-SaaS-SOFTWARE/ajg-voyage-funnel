import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const recovery = fs.readFileSync(new URL("../lib/site-recovery.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/data/page.tsx", import.meta.url), "utf8");
const billing = fs.readFileSync(new URL("../lib/billing-access.ts", import.meta.url), "utf8");

test("recovery accepts only ELTARA v2/v3 exports for the exact same site", () => {
  assert.match(recovery, /ajg-builder-export-v2/);
  assert.match(recovery, /ajg-builder-export-v3/);
  assert.match(recovery, /payload\.site\.id !== target\.id/);
  assert.match(recovery, /recovery_site_mismatch/);
  assert.match(recovery, /unsupported_recovery_format/);
  assert.match(recovery, /slug: target\.slug/);
});

test("recovery normalizes controlled configuration fields instead of trusting raw JSON", () => {
  assert.match(recovery, /normalizeSiteDesign/);
  assert.match(recovery, /normalizeSiteLegalConfig/);
  assert.match(recovery, /normalizeSiteArchitecture/);
  assert.match(recovery, /normalizeContentLibrary/);
  assert.match(recovery, /defaultSiteConfig/);
});

test("recovery UI creates a draft and never immediately overwrites the public version", () => {
  assert.match(page, /saveMySite\(preview\.config, false, site\.id\)/);
  assert.match(page, /version publique actuelle reste en ligne/);
  assert.match(page, /current public version stays online/);
  assert.match(page, /application\/json,\.json/);
  assert.match(page, /2 \* 1024 \* 1024/);
});

test("data area exposes both a full archive and a dedicated JSON recovery file", () => {
  assert.match(billing, /format=json/);
  assert.match(billing, /downloadMySiteRecoveryJson/);
  assert.match(page, /Télécharger le fichier de restauration/);
  assert.match(page, /Download recovery file/);
});
