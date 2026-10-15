import test from "node:test";
import assert from "node:assert/strict";
import { generatePremiumSiteArchitect } from "../lib/premium-site-architect.ts";

// Stop at the real provider boundary: no API key, network or paid generation.
async function strategyPayload(overrides = {}) {
  let payload;
  const stop = new Error("captured_provider_request");
  await assert.rejects(generatePremiumSiteArchitect({
    apiKey: "test-only", mode: "create", language: "French", affiliationRules: "",
    firstName: "", brandName: "", instruction: "", architectBrief: "Réparation de vélos à Nantes.",
    ...overrides,
    providerFetch: async (_url, options) => {
      payload = JSON.parse(JSON.parse(options.body).input);
      throw stop;
    }
  }), error => error === stop);
  return payload;
}

test("provider context omits empty top-level fields without losing the brief or language", async () => {
  const payload = await strategyPayload();
  assert.deepEqual(payload, { mode: "create", language: "French", brief: "Réparation de vélos à Nantes." });
  const previous = { ...payload, firstName: "", brandName: "", revisionRequest: "", instruction: "",
    editorialContext: "", currentText: "", existingProposal: null, contentLibrary: [] };
  assert.ok(JSON.stringify(previous).length - JSON.stringify(payload).length >= 140);
});

test("supplied revision context remains intact including nested false, empty and zero values", async () => {
  const existingProposal = { heroTitle: "Titre conservé", architecture: { pages: [
    { id: "home", slug: "", enabled: true }, { id: "contact", enabled: false }
  ] }, figures: { value: 0 } };
  const contentLibrary = [{ id: "source", text: "Tarif fourni : 25 euros", rights: "unknown", publishable: false }];
  const payload = await strategyPayload({ mode: "revision", language: "English", firstName: "Alex",
    brandName: "Atelier", instruction: "Preserve facts", revisionRequest: "Shorten only the subtitle",
    editorialContext: "Intervention à Nantes", currentText: "Texte à raccourcir", existingProposal, contentLibrary });
  assert.deepEqual(payload, { mode: "revision", language: "English", firstName: "Alex", brandName: "Atelier",
    brief: "Réparation de vélos à Nantes.", instruction: "Preserve facts", revisionRequest: "Shorten only the subtitle",
    editorialContext: "Intervention à Nantes", currentText: "Texte à raccourcir", existingProposal, contentLibrary });
});

test("create mode still excludes an unrelated existing proposal", async () => {
  const payload = await strategyPayload({ existingProposal: { heroTitle: "Ancienne proposition" } });
  assert.equal(Object.hasOwn(payload, "existingProposal"), false);
});
