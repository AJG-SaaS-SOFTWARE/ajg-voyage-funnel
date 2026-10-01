import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const home = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const feedback = fs.readFileSync(new URL("../app/feedback/page.tsx", import.meta.url), "utf8");

test("active Beta Testers receive a guided mission without billing ambiguity", () => {
  assert.match(home, /getMyBetaAccess/);
  assert.match(home, /betaAccess\.active/);
  assert.match(home, /Testez le parcours comme un vrai client/);
  assert.match(home, /n’active aucun abonnement Stripe/);
  assert.match(home, /href="\/feedback"/);
});

test("beta feedback is linked to the user's current website when available", () => {
  assert.match(feedback, /getMySite\(\)/);
  assert.match(feedback, /setSiteId\(site\?\.id \|\| null\)/);
  assert.match(feedback, /submitFeedback\(\{ category, rating, message, siteId \}\)/);
  assert.match(feedback, /identifiant technique/);
});
