import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { architectRequestAssets, architectRevisionBaseline } from "../lib/architect-request-context.ts";
import { generatePremiumSiteArchitect } from "../lib/premium-site-architect.ts";

test("revision sends the chosen module order, disabled pages and factual library text to the provider", async () => {
  const modules = { order: ["contact", "faq", "gallery", "benefits"], contact: { enabled: true },
    faq: { enabled: true, title: "Questions", items: [] }, gallery: { enabled: false },
    benefits: { enabled: false, title: "Avantages", items: [] } };
  const architecture = { mode: "single", pages: [
    { id: "home", slug: "", title: "Accueil", enabled: true, assetIds: ["portrait"] },
    { id: "later", slug: "suite", title: "Plus tard", enabled: false, assetIds: [] }
  ] };
  const config = { heroTagline: "Atelier local", heroTitle: "Réparation de vélos", heroSubtitle: "À Nantes",
    aboutHeading: "Notre atelier", aboutText: "Réparation sur rendez-vous", bookingLabel: "Nous contacter", architecture,
    design: { layout: "editorial", heroLayout: "split", contentWidth: "balanced", accent: "#264653",
      background: "ivory", pattern: "none", patternStrength: "soft", modules } };
  const assets = [{ id: "hours", kind: "text", name: "Horaires", text: "Ouvert du mardi au samedi",
    rights: "unknown", publishable: false, sourceUrl: "https://example.test/source", notes: "À confirmer", url: "private-storage-url" }];
  const baseline = architectRevisionBaseline(config);
  let request;
  const stop = new Error("captured_request");
  await assert.rejects(generatePremiumSiteArchitect({
    apiKey: "test-only", mode: "revision", language: "French", affiliationRules: "", firstName: "", brandName: "",
    instruction: "Raccourcir le sous-titre seulement", architectBrief: "", revisionRequest: "Raccourcir le sous-titre seulement",
    existingProposal: baseline, contentLibrary: architectRequestAssets(assets),
    providerFetch: async (_url, options) => { request = JSON.parse(JSON.parse(options.body).input); throw stop; }
  }), error => error === stop);
  assert.deepEqual(request.existingProposal.moduleOrder, modules.order);
  assert.deepEqual(request.existingProposal.recommendedModules, ["contact", "faq"]);
  assert.deepEqual(request.existingProposal.architecture, architecture);
  assert.equal(request.existingProposal.heroTitle, config.heroTitle);
  assert.equal(request.contentLibrary[0].text, assets[0].text);
  assert.equal(request.contentLibrary[0].publishable, false);
  assert.equal(request.contentLibrary[0].rights, "unknown");
  assert.equal(request.contentLibrary[0].sourceUrl, assets[0].sourceUrl);
  assert.equal(JSON.stringify(request).includes("private-storage-url"), false);
});

test("text architect excludes binary media payloads and private asset URLs", () => {
  const [result] = architectRequestAssets([{ id: "portrait", kind: "image", name: "Portrait", text: "data:image/png;base64,payload",
    rights: "owned", publishable: true, sourceUrl: "", notes: "Accueil seulement", url: "private-storage-url" }]);
  assert.equal(result.text, "");
  assert.equal(result.notes, "Accueil seulement");
  assert.equal(result.publishable, true);
  assert.equal(Object.hasOwn(result, "url"), false);
});

test("builder shares asset projection across creation, reuse fingerprint and revision", () => {
  const source = fs.readFileSync(new URL("../app/builder/page.tsx", import.meta.url), "utf8");
  assert.equal(source.match(/architectRequestAssets\(config\.contentLibrary\.assets\)/g)?.length, 3);
  assert.ok(source.includes("const existingProposal = architectRevisionBaseline(config)"));
});
