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
  assert.match(source, /Action required for your ELTARA subscription/);
  assert.match(source, /Action requise sur votre abonnement ELTARA/);
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
  assert.match(plans, /Your full BUILD \+ Growth rights remain active/);
  assert.match(compliance, /Website legal information/);
  assert.match(modules, /Section order/);
});


test("keeps the synchronized commercial pricing grid bilingual", () => {
  const plans = read("app/plans/page.tsx");
  const home = read("app/page.tsx");
  const shell = read("components/AccountShell.tsx");

  assert.match(plans, /15 €/);
  assert.match(plans, /150 €/);
  assert.match(plans, /29 €/);
  assert.match(plans, /290 €/);
  assert.match(plans, /Création IA · 49 €/);
  assert.match(plans, /Essential €15 \/ Growth €29 \/ AI Launch €49/);
  assert.match(home, /\/pricing/);
  assert.match(home, /\/tarifs/);
  assert.match(shell, /Pricing/);
  assert.match(shell, /Tarifs/);
});


test("global metadata follows the same server locale and the manifest stays language-neutral", () => {
  const layout = read("app/layout.tsx");
  const manifest = read("app/manifest.ts");

  assert.match(layout, /async function requestLocale\(\): Promise<ProductLocale>/);
  assert.match(layout, /export async function generateMetadata\(\): Promise<Metadata>/);
  assert.match(layout, /ELTARA turns your activity into a professional digital presence/);
  assert.match(layout, /ELTARA transforme votre activité en présence digitale professionnelle/);
  assert.match(layout, /Build, publish and improve your professional website/);
  assert.match(layout, /Élevez votre présence digitale/);
  assert.match(layout, /const initialLocale = await requestLocale\(\)/);

  assert.match(manifest, /ELTARA · BUILD · RUN · GROW · by AJG Horizon/);
  assert.doesNotMatch(manifest, /Élevez votre présence digitale avec un espace guidé/);
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


test("client-side repository, image and feedback errors are localized", () => {
  const repository = read("lib/supabase-site-repository.ts");
  const billing = read("lib/billing-access.ts");
  const image = read("lib/optimize-image.ts");
  const analytics = read("lib/product-analytics.ts");

  assert.match(repository, /Your storage quota has been reached/);
  assert.match(repository, /You must be signed in/);
  assert.match(repository, /Unable to save this domain/);
  assert.match(billing, /Supabase is not configured/);
  assert.match(billing, /Your session has expired/);
  assert.match(image, /The image must not exceed 12 MB/);
  assert.match(image, /Unable to prepare this image/);
  assert.match(image, /Unable to compress this image/);
  assert.match(analytics, /Sign in required/);
  assert.match(analytics, /Add a few words so we can understand your feedback/);
  assert.match(analytics, /Unable to save your feedback right now/);
  assert.match(analytics, /Unable to save this rating right now/);
  assert.doesNotMatch(image, /reject\(new Error\("Impossible de compresser cette image\."/);
  assert.doesNotMatch(analytics, /throw new Error\("Connexion requise\."/);
});

test("Builder quality and publish summary labels are localized", () => {
  const builder = read("app/builder/page.tsx");

  assert.match(builder, /tr\("Voir →", "View →"\)/);
  assert.match(builder, /tr\("Corriger →", "Fix →"\)/);
  assert.match(builder, /tr\("Français \(bilingue à venir\)", "French \(bilingual coming soon\)"\)/);
  assert.match(builder, /tr\("Navigateur local", "Local browser"\)/);

  assert.doesNotMatch(builder, /\? "Voir →" : "Corriger →"/);
  assert.doesNotMatch(builder, /\? "Français \(bilingue à venir\)" : config\.language/);
  assert.doesNotMatch(builder, /: "Navigateur local"}/);
});

test("guided Builder and compliance labels are localized", () => {
  const builder = read("app/builder/page.tsx");
  const compliance = read("components/ComplianceEditor.tsx");

  assert.match(
    builder,
    /tr\("Vous pourrez modifier chaque phrase ensuite\.", "You can edit every sentence afterwards\."\)/
  );
  assert.doesNotMatch(builder, /\n\s*Vous pourrez modifier chaque phrase ensuite\./);
  assert.match(compliance, /tr\("Profil MWR Life", "MWR Life profile"\)/);
  assert.doesNotMatch(compliance, /<b>Profil MWR Life<\/b>/);
});

test("English Builder core has no known French-only residuals in customer paths", () => {
  const builder = read("app/builder/page.tsx");
  const privacyApi = read("app/api/privacy/erasure/request/route.ts");
  const data = read("app/data/page.tsx");

  assert.doesNotMatch(builder, />Architecture : /);
  assert.doesNotMatch(builder, />Structure : /);
  assert.doesNotMatch(builder, />Direction visuelle : /);
  assert.match(
    builder,
    /tr\("Ces réponses sont facultatives\. Répondez uniquement[^"]+", "These answers are optional\./
  );
  assert.doesNotMatch(builder, /throw new Error\("Connectez le stockage du site/);

  assert.doesNotMatch(privacyApi, /error: "Reconnectez-vous pour continuer\."/);
  assert.doesNotMatch(privacyApi, /error: "Impossible d'enregistrer la demande\."/);
  assert.match(privacyApi, /Sign in again to continue/);
  assert.match(privacyApi, /Unable to record the request/);

  assert.doesNotMatch(data, /: "Impossible d'enregistrer la demande\."/);
  assert.match(data, /Unable to record the request/);
});


test("authentication and beta invitation preserve the chosen locale across email redirects", () => {
  const login = read("app/login/page.tsx");
  const provider = read("components/ProductLocaleProvider.tsx");
  const betaRoute = read("app/api/admin/beta-cohort/route.ts");
  const adminClient = read("lib/admin.ts");
  const adminPage = read("app/admin/page.tsx");

  assert.match(login, /builder\?lang=\$\{locale\}/);
  assert.match(login, /The sign-in link could not be sent/);
  assert.match(provider, /URLSearchParams\(window\.location\.search\)/);
  assert.match(provider, /explicitLocale/);
  assert.match(betaRoute, /ajg_builder_locale: locale/);
  assert.match(betaRoute, /builder\?lang=\$\{locale\}/);
  assert.match(adminClient, /durationDays = 30, locale: "fr" \| "en" = "fr"/);
  assert.match(adminPage, /Langue du testeur/);
  assert.match(adminPage, /English/);
});


test("customer-facing dates never fall back to the browser locale implicitly", () => {
  const support = read("app/support/page.tsx");
  const home = read("app/page.tsx");
  const plans = read("app/plans/page.tsx");
  const messages = read("app/messages/page.tsx");
  const billing = read("app/billing/page.tsx");
  const data = read("app/data/page.tsx");

  assert.match(
    support,
    /toLocaleDateString\(locale === "en" \? "en-GB" : "fr-FR"\)/
  );

  for (const source of [support, home, plans, messages, billing, data]) {
    assert.doesNotMatch(source, /\.toLocaleDateString\(\s*\)/);
    assert.doesNotMatch(source, /\.toLocaleString\(\s*\)/);
  }
});

test("billing notification catalogue covers every customer state in both languages", () => {
  const source = read("app/api/cron/billing-notifications/route.ts");
  for (const key of [
    "payment_failed",
    "reminder_j3",
    "reminder_j7",
    "reminder_j12",
    "retention_j74",
    "retention_j97",
    "reactivated"
  ]) {
    const occurrences = source.split(key).length - 1;
    assert.ok(occurrences >= 2, key + " must exist in FR and EN catalogues");
  }
  assert.match(source, /Open Billing/);
  assert.match(source, /Accéder à votre espace/);
  assert.match(source, /ajg_builder_locale/);
});
