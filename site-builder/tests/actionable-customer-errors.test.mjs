import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const aiField = fs.readFileSync(new URL("../components/AiTextAssistant.tsx", import.meta.url), "utf8");
const moduleAi = fs.readFileSync(new URL("../components/ModuleDraftAssistant.tsx", import.meta.url), "utf8");
const content = fs.readFileSync(new URL("../components/ContentLibraryEditor.tsx", import.meta.url), "utf8");
const builder = fs.readFileSync(new URL("../app/builder/page.tsx", import.meta.url), "utf8");
const domains = fs.readFileSync(new URL("../app/domains/page.tsx", import.meta.url), "utf8");

test("customer AI fallbacks never stop at a generic error", () => {
  assert.ok(!aiField.includes('"Une erreur est survenue."'));
  assert.ok(!aiField.includes('"An error occurred."'));
  assert.ok(!moduleAi.includes('"Une erreur est survenue."'));
  assert.ok(!moduleAi.includes('"An error occurred."'));
  assert.match(aiField, /continuer à le modifier manuellement/);
  assert.match(moduleAi, /remplir la rubrique manuellement/);
});

test("save publish upload and domain fallbacks expose a next action", () => {
  assert.match(builder, /Vérifiez votre connexion puis réessayez/);
  assert.match(builder, /ouvrez le Health Center sans recréer le site/);
  assert.match(content, /vérifiez le fichier et votre connexion puis réessayez/);
  assert.match(domains, /Actualisez la page ; si le problème persiste, ouvrez le Health Center/);
  assert.match(domains, /Contrôlez les enregistrements DNS affichés puis relancez la vérification/);
  assert.match(domains, /le domaine reste inchangé tant que l’opération n’a pas réussi/);
});
