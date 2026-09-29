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
  assert.ok(source.includes("disabled={!siteArchitectCreateAvailable}"));
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

test("Locked BUILD and Growth cards route to plan or billing recovery", () => {
  assert.ok(source.includes('premiumAccessHref === "/billing"'));
  assert.ok(source.includes('"Régulariser mon accès"'));
  assert.ok(source.includes('"Voir Growth / Création IA"'));
  assert.ok(source.includes("premium-feature-lock-note"));
  assert.ok(source.includes('"🔒 BUILD"'));
  assert.ok(source.includes('"🔒 Growth"'));
});
