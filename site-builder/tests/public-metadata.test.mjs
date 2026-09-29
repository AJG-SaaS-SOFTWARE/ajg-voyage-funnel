import test from "node:test";
import assert from "node:assert/strict";
import {
  legalMetadataLabel,
  publicMetadataText
} from "../lib/public-metadata.ts";

function config(overrides = {}) {
  return {
    brandName: "Studio Horizon",
    firstName: "Camille",
    lastName: "Martin",
    language: "fr",
    heroTitle: "Des images qui racontent votre histoire",
    heroSubtitle: "Photographie naturelle pour particuliers et professionnels.",
    aboutText: "Je crée des images attentives et durables.",
    profileImageUrl: "",
    ...overrides
  };
}

test("home metadata is generic to the customer activity and no longer hardcodes Voyage", () => {
  const meta = publicMetadataText(config());
  assert.equal(
    meta.title,
    "Des images qui racontent votre histoire | Studio Horizon"
  );
  assert.ok(!meta.title.includes("Voyage"));
});

test("metadata avoids repeating an identical brand and headline", () => {
  const meta = publicMetadataText(
    config({ heroTitle: "Studio Horizon" })
  );
  assert.equal(meta.title, "Studio Horizon");
});

test("subpage metadata uses the page navigation title with the brand", () => {
  const meta = publicMetadataText(config(), "Prestations");
  assert.equal(meta.title, "Prestations | Studio Horizon");
});

test("metadata descriptions are compacted and capped for search snippets", () => {
  const meta = publicMetadataText(
    config({ heroSubtitle: "  Une   phrase ".repeat(30) })
  );
  assert.ok(meta.description.length <= 160);
  assert.ok(!meta.description.includes("  "));
});

test("English legal labels follow the configured language", () => {
  const value = config({ language: "en" });
  assert.equal(legalMetadataLabel(value, "mentions-legales"), "Legal notice");
  assert.equal(legalMetadataLabel(value, "confidentialite"), "Privacy");
  assert.equal(legalMetadataLabel(value, "cookies"), "Cookies");
});


test("published missing-page metadata follows the website language", async () => {
  const { readFileSync } = await import("node:fs");
  const subpage = readFileSync(new URL("../app/site/[slug]/p/[pageSlug]/page.tsx", import.meta.url), "utf8");
  const domain = readFileSync(new URL("../app/domain/[hostname]/[[...path]]/page.tsx", import.meta.url), "utf8");

  assert.match(subpage, /site\.config\.language === "en" \? "Page not found" : "Page introuvable"/);
  assert.match(domain, /site\.config\.language==="en"\?"Page not found":"Page introuvable"/);
  assert.match(subpage, /Website not found \/ Site introuvable/);
});
