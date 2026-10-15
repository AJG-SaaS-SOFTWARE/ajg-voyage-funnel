import test from "node:test";
import assert from "node:assert/strict";
import { safeAssets } from "../lib/premium-site-architect.ts";

test("empty assets and exact repeats cannot exhaust the twenty-source window", () => {
  const repeated = { id: "portrait", kind: "image", rights: "owned", publishable: true };
  const evidence = { id: "offer", text: "Réparation de vélos à Nantes", publishable: false };
  const source = [...Array(20).fill({}), ...Array(20).fill(repeated), evidence];
  const before = structuredClone(source);
  const selected = safeAssets(source);
  assert.deepEqual(selected, [repeated, evidence]);
  assert.deepEqual(source, before);
  assert.ok(JSON.stringify(selected).length < JSON.stringify(source).length / 5);
});

test("asset identity preserves distinct IDs, facts, rights and publication restrictions", () => {
  const base = { id: "a", text: "Texte fourni", rights: "owned", publishable: true };
  const variants = [base, { ...base, id: "b" }, { ...base, text: "Autre fait" },
    { ...base, rights: "unknown" }, { ...base, publishable: false },
    { ...base, notes: "Interdit sur la page d’accueil" },
    { ...base, sourceUrl: "https://example.test/source" }];
  assert.deepEqual(safeAssets([...variants, ...variants]), variants);
});

test("compaction deduplicates normalized records in stable order and retains the cap", () => {
  const records = Array.from({ length: 25 }, (_, i) => ({ id: `a-${i}`, text: `Fait ${i}`, publishable: false }));
  assert.deepEqual(safeAssets([{ id: " a-0 ", text: " Fait 0 ", notes: " " }, ...records]), records.slice(0, 20));
  assert.deepEqual(safeAssets([null, {}, { text: " " }, { publishable: true }]), []);
});
