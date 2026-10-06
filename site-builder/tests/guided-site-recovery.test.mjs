import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL("../lib/site-recovery.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/data/page.tsx", import.meta.url), "utf8");
const billing = fs.readFileSync(new URL("../lib/billing-access.ts", import.meta.url), "utf8");

const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText;
const module = { exports: {} };
new Function("require", "module", "exports", code)(require, module, module.exports);
const { siteConfigFromRecoveryExport } = module.exports;

const target = { id: "11111111-1111-4111-8111-111111111111", slug: "demo" };
const base = {
  format: "ajg-builder-export-v2",
  exportedAt: "2026-10-01T10:00:00.000Z",
  site: {
    id: target.id,
    slug: "demo",
    config: {
      firstName: "Alex",
      lastName: "Martin",
      brandName: "Demo",
      primaryLanguage: "fr",
      enabledLanguages: ["fr", "en"],
      heroTitle: "Titre",
      heroSubtitle: "Sous-titre",
      heroTagline: "Tagline",
      aboutText: "À propos",
      aboutHeading: "Qui suis-je",
      bookingLabel: "Réserver",
      bookingUrl: "https://example.com",
      instagramUrl: "",
      facebookUrl: "",
      profileImageUrl: "",
      showTravelJournals: false,
      designAssets: {},
      legalConfig: {},
      complianceProfile: "independent-v1"
    }
  }
};

test("recovery accepts ELTARA exports only for the exact same site and forces the current slug", () => {
  const restored = siteConfigFromRecoveryExport(base, target);
  assert.equal(restored.config.slug, "demo");
  assert.equal(restored.config.language, "both");
  assert.equal(restored.config.affiliation, "independent");
  assert.equal(restored.exportedAt, base.exportedAt);
  assert.throws(() => siteConfigFromRecoveryExport({ ...base, site: { ...base.site, id: "22222222-2222-4222-8222-222222222222" } }, target), /recovery_site_mismatch/);
  assert.throws(() => siteConfigFromRecoveryExport({ ...base, format: "unknown" }, target), /unsupported_recovery_format/);
});

test("recovery UI creates a draft and never promises an immediate public overwrite", () => {
  assert.match(page, /saveMySite\(preview\.config, false, site\.id\)/);
  assert.match(page, /version publique actuelle reste en ligne/);
  assert.match(page, /current public version stays online/);
  assert.match(page, /application\/json,\.json/);
});

test("data area exposes both a full archive and a dedicated JSON recovery file", () => {
  assert.match(billing, /format=json/);
  assert.match(billing, /downloadMySiteRecoveryJson/);
  assert.match(page, /Télécharger le fichier de restauration/);
  assert.match(page, /Download recovery file/);
});
