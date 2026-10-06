import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../app/builder/page.tsx", import.meta.url),
  "utf8"
);

test("Builder loads site-scoped BUILD and Growth access", () => {
  assert.ok(source.includes("getMySiteEntitlements(remoteSiteId)"));
  assert.ok(source.includes("getMySiteAiAccess(remoteSiteId)"));
  assert.ok(source.includes("siteAiAccess.canCreateSite"));
  assert.ok(source.includes("siteAiAccess.canReviseSite"));
  assert.ok(source.includes('["active", "trialing"].includes(siteEntitlements.status)'));
});

test("AI Architect creation and Growth revision controls have distinct gates", () => {
  assert.ok(source.includes("{siteArchitectCreateAvailable ? ("));
  assert.ok(source.includes("showGrowthRevisionWorkspace = siteRevisionAvailable && published"));
  assert.ok(source.includes("{showGrowthRevisionWorkspace ? ("));
  assert.ok(
    source.includes(
      "disabled={!siteArchitectCreateAvailable || architectLoading || !architectBriefReady}"
    )
  );
  assert.ok(
    source.includes(
      "disabled={!siteRevisionAvailable || revisionLoading || !revisionRequest.trim()}"
    )
  );
});

test("Unavailable BUILD and Growth tools use progressive discovery instead of locked editor cards", () => {
  assert.ok(source.includes("showAdvancedDiscovery"));
  assert.ok(source.includes("advanced-discovery-card"));
  assert.ok(source.includes('"Découvrir les fonctions avancées"'));
  assert.ok(source.includes('"Aucune fonction verrouillée n’encombre votre éditeur."'));
  assert.ok(source.includes('premiumAccessHref === "/billing"'));
  assert.ok(source.includes('"Régulariser mon accès"'));
  assert.ok(source.includes('"Voir Growth / Création IA"'));
  assert.equal(source.includes('"🔒 BUILD"'), false);
  assert.equal(source.includes('"🔒 Growth"'), false);
});
