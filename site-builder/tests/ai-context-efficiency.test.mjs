import test from "node:test";
import assert from "node:assert/strict";
import { omitRepeatedEditableContext, selectStandardContextEntries } from "../lib/standard-ai-writer.ts";
import { safeAssets } from "../lib/premium-site-architect.ts";

test("About rewriting sends the full editable text once without losing adjacent facts", () => {
  const current = "Une présentation vérifiée. ".repeat(80);
  const entries = [["about", current.slice(0, 900)], ["about heading", "Notre histoire"],
    ["activity or offer", "Atelier de réparation"], ["audience", "Habitants du quartier"]];
  const compact = omitRepeatedEditableContext("aboutText", current, entries);
  assert.equal(compact.some(([key]) => key === "about"), false);
  assert.deepEqual(compact, entries.slice(1));
  assert.equal(selectStandardContextEntries("aboutText", compact).length, 3);
  assert.ok(JSON.stringify(compact).length < JSON.stringify(entries).length - 850);
});
test("every field removes only its own duplicate; structured tasks keep all available evidence", () => {
  const pairs = { heroTitle:"headline", heroSubtitle:"intro", heroTagline:"tagline",
    aboutText:"about", aboutHeading:"about heading", bookingLabel:"booking button" };
  const entries = Object.values(pairs).map(key => [key, "Faits distincts : " + key]);
  for (const [field, key] of Object.entries(pairs)) {
    assert.deepEqual(omitRepeatedEditableContext(field, "Texte actuel", entries), entries.filter(([name]) => name !== key));
  }
  for (const field of ["qualityReview", "guidedDraft", "moduleDraft", "siteRevision"]) {
    assert.deepEqual(omitRepeatedEditableContext(field, "Texte actuel", entries), entries);
  }
  assert.deepEqual(omitRepeatedEditableContext("aboutText", "", entries), entries);
});
test("premium asset compaction preserves all supplied facts and explicit publication refusal", () => {
  const original = { id:"image-1", kind:"image", name:"Portrait", text:"", rights:"owned",
    publishable:false, sourceUrl:"", notes:"" };
  assert.deepEqual(safeAssets([original]), [{ id:"image-1",kind:"image",name:"Portrait",rights:"owned",publishable:false }]);
  const detailed = { ...original, text:"Texte métier vérifié", sourceUrl:"https://example.test/image", notes:"Utiliser seulement sur l’accueil" };
  assert.deepEqual(safeAssets([detailed]), [detailed]);
  const assets = Array.from({length:20}, (_,i) => ({...original,id:`image-${i}`}));
  assert.ok(JSON.stringify(safeAssets(assets)).length < JSON.stringify(assets).length);
});
