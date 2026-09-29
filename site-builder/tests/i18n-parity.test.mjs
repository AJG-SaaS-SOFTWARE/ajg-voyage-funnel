import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("product locale synchronizes every mounted client surface", () => {
  const source = read("lib/product-i18n.ts");
  assert.match(source, /ajg-builder-locale-change/);
  assert.match(source, /dispatchEvent\(new CustomEvent/);
  assert.match(source, /addEventListener\(LOCALE_EVENT/);
  assert.match(source, /ajg_builder_language/);
});

test("language switch persists authenticated account preference", () => {
  const source = read("components/LanguageSwitch.tsx");
  assert.match(source, /ajg_builder_locale/);
  assert.match(source, /auth\.updateUser/);
  assert.match(source, /Français|Langue de l’interface/);
  assert.match(source, /Interface language/);
});

test("AI and billing requests carry interface locale to server routes", () => {
  const builder = read("app/builder/page.tsx");
  const fieldAssistant = read("components/AiTextAssistant.tsx");
  const moduleAssistant = read("components/ModuleDraftAssistant.tsx");
  const billing = read("lib/billing-access.ts");
  const privacy = read("lib/data-rights.ts");

  for (const source of [builder, fieldAssistant, moduleAssistant, billing, privacy]) {
    assert.match(source, /X-AJG-Locale/);
  }
});

test("critical server APIs localize user-facing errors", () => {
  const ai = read("app/api/ai/write/route.ts");
  const checkout = read("app/api/billing/checkout/route.ts");
  const portal = read("app/api/billing/portal/route.ts");
  const privacy = read("app/api/privacy/erasure/request/route.ts");

  for (const source of [ai, checkout, portal, privacy]) {
    assert.match(source, /requestProductLocale/);
    assert.match(source, /localize/);
  }

  assert.match(ai, /Sign in again before using the AI assistant/);
  assert.match(checkout, /Unable to open Stripe Checkout right now/);
  assert.match(portal, /Unable to open the Stripe portal right now/);
  assert.match(privacy, /Type your account email address exactly to confirm/);
});

test("billing notification emails support French and English", () => {
  const source = read("app/api/cron/billing-notifications/route.ts");
  assert.match(source, /Action required for your AJG Builder subscription/);
  assert.match(source, /Action requise sur votre abonnement AJG Builder/);
  assert.match(source, /ajg_builder_locale/);
  assert.match(source, /site\.config\?\.language/);
});

test("core builder surfaces expose English product copy", () => {
  const builder = read("app/builder/page.tsx");
  const plans = read("app/plans/page.tsx");
  const compliance = read("components/ComplianceEditor.tsx");
  const modules = read("components/ModulesEditor.tsx");

  assert.match(builder, /Create my website with AI/);
  assert.match(builder, /Final review/);
  assert.match(builder, /Publish website/);
  assert.match(plans, /Full Pro access included during beta/);
  assert.match(compliance, /Website legal information/);
  assert.match(modules, /Section order/);
});


test("keeps the synchronized commercial pricing grid bilingual", () => {
  const plans = read("app/plans/page.tsx");
  const home = read("app/page.tsx");
  const shell = read("components/AccountShell.tsx");

  assert.match(plans, /19 €/);
  assert.match(plans, /190 €/);
  assert.match(plans, /39 €/);
  assert.match(plans, /390 €/);
  assert.match(plans, /Essential €19 \/ Pro AI €39/);
  assert.match(home, /\/pricing/);
  assert.match(home, /\/tarifs/);
  assert.match(shell, /Pricing/);
  assert.match(shell, /Tarifs/);
});


test("server-seeded locale avoids a French-first render for English users", () => {
  const layout = read("app/layout.tsx");
  const provider = read("components/ProductLocaleProvider.tsx");
  const locale = read("lib/product-i18n.ts");

  assert.match(layout, /cookies\(\)/);
  assert.match(layout, /accept-language/);
  assert.match(layout, /ProductLocaleProvider/);
  assert.match(layout, /html lang=\{initialLocale\}/);
  assert.match(provider, /initialLocale/);
  assert.match(provider, /ProductLocaleContext\.Provider/);
  assert.match(locale, /persistProductLocale/);
});


test("client-side repository and image errors are localized", () => {
  const repository = read("lib/supabase-site-repository.ts");
  const billing = read("lib/billing-access.ts");
  const image = read("lib/optimize-image.ts");

  assert.match(repository, /Your storage quota has been reached/);
  assert.match(repository, /You must be signed in/);
  assert.match(repository, /Unable to save this domain/);
  assert.match(billing, /Supabase is not configured/);
  assert.match(billing, /Your session has expired/);
  assert.match(image, /The image must not exceed 12 MB/);
  assert.match(image, /Unable to prepare this image/);
});


test("public pricing routes declare their explicit language at SSR", () => {
  const middleware = read("middleware.ts");
  const layout = read("app/layout.tsx");
  assert.match(middleware, /x-ajg-route-locale/);
  assert.match(middleware, /pathname==="\/pricing"/);
  assert.match(layout, /headerStore\.get\("x-ajg-route-locale"\)/);
  assert.match(layout, /routeLocale === "en" \|\| routeLocale === "fr"/);
});


test("generated public site declares its own content language", () => {
  const source = read("components/PublishedSite.tsx");
  assert.match(source, /lang=\{english \? "en" : "fr"\}/);
  assert.match(source, /english \? "Audio" : "Son"/);
});
