import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const modules = new Map();
function load(name) {
  if (modules.has(name)) return modules.get(name);
  const code = ts.transpileModule(fs.readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const loaded = { exports: {} };
  modules.set(name, loaded.exports);
  new Function("require", "module", "exports", code)(dependency => {
    assert.ok(dependency.startsWith("./"));
    return load(dependency.slice(2));
  }, loaded, loaded.exports);
  return loaded.exports;
}
const { siteConfigFromRecoveryExport } = load("site-recovery");
const target = { id: "site-synthetic", slug: "current-slug" };
function fixture(format = "ajg-builder-export-v3") {
  return { format, exportedAt: "2026-10-12T12:00:00.000Z", site: { id: target.id, slug: "old-slug", config: {
    firstName: "Alex", lastName: "Test", brandName: "Synthetic studio", heroTitle: "A useful website",
    heroSubtitle: "Synthetic subtitle", aboutText: "Synthetic description", bookingLabel: "Book",
    bookingUrl: "https://example.test/book", profileImageUrl: "", instagramUrl: "", facebookUrl: "",
    showTravelJournals: false, primaryLanguage: "fr", enabledLanguages: ["fr", "en"],
    complianceProfile: "independent-v1", designAssets: { accent: "#123456" }, legalConfig: {}
  } } };
}

test("real v2 and v3 export shapes retain content, branding and current site identity", () => {
  for (const format of ["ajg-builder-export-v2", "ajg-builder-export-v3"]) {
    const preview = siteConfigFromRecoveryExport(fixture(format), target);
    assert.equal(preview.config.heroTitle, "A useful website");
    assert.equal(preview.config.brandName, "Synthetic studio");
    assert.equal(preview.config.slug, target.slug);
    assert.equal(preview.sourceSlug, "old-slug");
    assert.equal(preview.config.language, "both");
    assert.equal(preview.config.affiliation, "independent");
    assert.equal(preview.config.design.accent, "#123456");
    assert.equal(preview.exportedAt, "2026-10-12T12:00:00.000Z");
  }
});

test("empty, array and incomplete configurations are rejected instead of creating blank drafts", () => {
  for (const config of [{}, [], null, { heroTitle: "partial" }]) {
    const input = fixture(); input.site.config = config;
    assert.throws(() => siteConfigFromRecoveryExport(input, target), { message: "invalid_recovery_file" });
  }
  for (const field of ["firstName", "lastName", "brandName", "heroTitle", "heroSubtitle", "aboutText", "bookingLabel", "bookingUrl", "profileImageUrl", "instagramUrl", "facebookUrl"]) {
    const input = fixture(); delete input.site.config[field];
    assert.throws(() => siteConfigFromRecoveryExport(input, target), { message: "invalid_recovery_file" });
    input.site.config[field] = 123;
    assert.throws(() => siteConfigFromRecoveryExport(input, target), { message: "invalid_recovery_file" });
  }
});

test("invalid language, compliance and boolean fields cannot silently switch site settings", () => {
  for (const mutation of [
    raw => { raw.primaryLanguage = "de"; }, raw => { raw.enabledLanguages = []; },
    raw => { raw.enabledLanguages = ["en"]; }, raw => { raw.enabledLanguages = ["fr", "de"]; },
    raw => { raw.complianceProfile = "unknown-profile"; }, raw => { delete raw.complianceProfile; },
    raw => { raw.showTravelJournals = "true"; }
  ]) {
    const input = fixture(); mutation(input.site.config);
    assert.throws(() => siteConfigFromRecoveryExport(input, target), { message: "invalid_recovery_file" });
  }
  const mwr = fixture(); mwr.site.config.complianceProfile = "mwr-life-independent-ambassador-v1";
  assert.equal(siteConfigFromRecoveryExport(mwr, target).config.affiliation, "independent");
});

test("missing newer optional fields and empty text remain compatible with older valid exports", () => {
  const input = fixture("ajg-builder-export-v2");
  for (const key of Object.keys(input.site.config)) if (typeof input.site.config[key] === "string" && !["primaryLanguage", "complianceProfile"].includes(key)) input.site.config[key] = "";
  const preview = siteConfigFromRecoveryExport(input, target);
  assert.equal(preview.config.heroTitle, "");
  assert.equal(preview.config.heroTagline, "");
  assert.equal(preview.config.aboutHeading, "");
});

test("invalid timestamps become unknown dates and cross-site recovery stays blocked", () => {
  const input = fixture(); input.exportedAt = "not-a-date";
  assert.equal(siteConfigFromRecoveryExport(input, target).exportedAt, null);
  input.site.id = "another-site";
  assert.throws(() => siteConfigFromRecoveryExport(input, target), { message: "recovery_site_mismatch" });
});

test("saved draft content, language, design and affiliation take precedence during recovery", () => {
  const input = fixture();
  input.site.draftConfig = {
    heroTitle: "Unpublished title", language: "en", affiliation: "mwr",
    design: { accent: "#abcdef" }, legal: { legalName: "Draft publisher" },
    architecture: { mode: "multi", pages: [] }, contentLibrary: { assets: [] }
  };
  const preview = siteConfigFromRecoveryExport(input, target);
  assert.equal(preview.source, "draft");
  assert.equal(preview.config.heroTitle, "Unpublished title");
  assert.equal(preview.config.brandName, "Synthetic studio");
  assert.equal(preview.config.language, "en");
  assert.equal(preview.config.affiliation, "independent");
  assert.equal(preview.config.design.accent, "#abcdef");
  assert.equal(preview.config.legal.legalName, "Draft publisher");
  assert.equal(preview.config.slug, target.slug);
  assert.equal(input.site.config.heroTitle, "A useful website");
});

test("older exports without drafts keep published recovery; malformed drafts never silently fall back", () => {
  assert.equal(siteConfigFromRecoveryExport(fixture(), target).source, "published");
  const input = fixture(); input.site.draftConfig = null;
  assert.equal(siteConfigFromRecoveryExport(input, target).source, "published");
  for (const draft of [[], "invalid", { language: "de" }, { affiliation: "unknown" }, { heroTitle: 42 }]) {
    input.site.draftConfig = draft;
    assert.throws(() => siteConfigFromRecoveryExport(input, target), { message: "invalid_recovery_file" });
  }
});
