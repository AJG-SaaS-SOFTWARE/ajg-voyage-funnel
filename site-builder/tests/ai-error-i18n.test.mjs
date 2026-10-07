import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("app/api/ai/write/route.ts", "utf8");

test("AI API capability failure is localized", () => {
  assert.match(
    source,
    /tr\("Impossible de vérifier les droits du site\.", "Unable to verify website permissions\."\)/
  );
  assert.doesNotMatch(
    source,
    /capabilityError\) return NextResponse\.json\(\{ error: "Impossible de vérifier les droits du site\."/
  );
});

test("AI API unusable standard output fallback is localized", () => {
  assert.match(
    source,
    /tr\("L'IA n'a pas renvoyé de texte exploitable\. Reformulez votre demande\.", "AI did not return usable text\. Rephrase your request\."\)/
  );
  assert.doesNotMatch(
    source,
    /: "L'IA n'a pas renvoyé de texte exploitable\. Reformulez votre demande\."/
  );
});
