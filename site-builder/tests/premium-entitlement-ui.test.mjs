import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../app/builder/page.tsx", import.meta.url),
  "utf8"
);

test("Builder loads site-scoped entitlements for Premium UX", () => {
  assert.ok(source.includes("getMySiteEntitlements(remoteSiteId)"));
  assert.ok(source.includes("siteEntitlements.premiumArchitect"));
  assert.ok(source.includes('["active", "trialing"].includes(siteEntitlements.status)'));
});

test("Premium architect controls are disabled when entitlement is unavailable", () => {
  assert.ok(source.includes("disabled={!premiumArchitectAvailable}"));
  assert.ok(
    source.includes(
      "disabled={!premiumArchitectAvailable || architectLoading || !architectBriefReady}"
    )
  );
  assert.ok(
    source.includes(
      "disabled={!premiumArchitectAvailable || revisionLoading || !revisionRequest.trim()}"
    )
  );
});

test("Locked Premium cards route to plan or billing recovery", () => {
  assert.ok(source.includes('premiumAccessHref === "/billing"'));
  assert.ok(source.includes('"Régulariser mon accès"'));
  assert.ok(source.includes('"Voir l’offre Pro"'));
  assert.ok(source.includes("premium-feature-lock-note"));
});
