import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("ELTARA brand assets and metadata are wired into the product", () => {
  const layout = read("app/layout.tsx");
  const manifest = read("app/manifest.ts");
  const brand = read("components/EltaraBrand.tsx");
  const icon = read("app/icon.svg");

  assert.match(layout, /applicationName:\s*"ELTARA"/);
  assert.match(layout, /AJG Horizon/);
  assert.match(manifest, /short_name:\s*"ELTARA"/);
  assert.match(manifest, /#4E79D8/);
  assert.match(brand, />ELTARA</);
  assert.match(brand, /by AJG Horizon/);
  assert.match(icon, /#4E79D8/);
  assert.match(icon, /#62D8EF/);
});

test("core customer-facing product surfaces no longer expose the legacy product name", () => {
  const paths = [
    "app/page.tsx",
    "app/login/page.tsx",
    "app/beta-access/page.tsx",
    "app/builder/page.tsx",
    "app/plans/page.tsx",
    "app/billing/page.tsx",
    "app/domains/page.tsx",
    "app/data/page.tsx",
    "app/growth/page.tsx",
    "app/analytics/page.tsx",
    "app/support/page.tsx",
    "app/messages/page.tsx",
    "components/PricingPage.tsx",
    "components/AccountShell.tsx",
    "components/AdminShell.tsx",
    "components/CommercialLegalPage.tsx",
    "app/admin/page.tsx",
    "app/api/admin/storage-backup/route.ts",
    "app/api/admin/builder-e2e/route.ts",
    "app/builder/page.tsx",
    "components/AdminShell.tsx",
    "app/admin/privacy/page.tsx"
  ];

  for (const path of paths) {
    assert.doesNotMatch(read(path), /AJG Site Builder|AJG Builder|Wellness CRM/);
  }
});

test("legacy technical identifiers remain stable during the brand migration", () => {
  const store = read("lib/site-store.ts");
  const billing = read("lib/stripe-billing.ts");
  assert.match(store, /ajg-site-builder:draft/);
  assert.match(billing, /ajg_site_builder/);
});

test("ELTARA visual identity no longer depends on travel photography", () => {
  const home = read("app/page.tsx");
  const css = read("app/globals.css");
  assert.match(home, /EltaraMark/);
  assert.match(home, /eltara-hero-art/);
  assert.doesNotMatch(home, /images\.pexels\.com/);
  assert.doesNotMatch(css, /images\.pexels\.com/);
  assert.match(css, /#432B86|var\(--eltara-indigo/);
  assert.match(css, /#62D8EF/);
});

