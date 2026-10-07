import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(
  new URL("../components/SiteLegalPages.tsx", import.meta.url),
  "utf8"
);

const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true
  }
}).outputText;

function loadPages() {
  const jsx = (type, props) => ({ type, props: props || {} });
  const dependencies = {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "next/link": "link",
    "../lib/site-legal": {
      effectivePrivacyEmail: () => "privacy@example.com",
      effectivePublicationDirector: () => "Camille Martin",
      effectivePublisherName: () => "Studio Horizon",
      hostingProvider: {
        name: "Vercel",
        address: "340 S Lemon Ave #4133, Walnut, CA 91789, USA",
        phone: "+1 559 288 7060",
        website: "https://vercel.com"
      }
    }
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(
    (name) => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    module,
    module.exports
  );
  return module.exports;
}

function textContent(tree) {
  if (tree === null || tree === undefined || typeof tree === "boolean") return "";
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  if (Array.isArray(tree)) return tree.map(textContent).join(" ");
  if (typeof tree === "object") return textContent(tree.props?.children);
  return "";
}

function config(language) {
  return {
    language,
    slug: "studio-horizon",
    brandName: "Studio Horizon",
    firstName: "Camille",
    lastName: "Martin",
    bookingUrl: "",
    instagramUrl: "",
    facebookUrl: "",
    legal: {
      tradeName: "",
      publisherType: "individual",
      legalForm: "",
      shareCapital: "",
      address: "1 rue Exemple, 31000 Toulouse",
      email: "hello@example.com",
      phone: "+33 5 00 00 00 00",
      siren: "123 456 789",
      registrationDetails: "",
      vatNumber: "",
      regulatedActivity: false,
      professionalTitle: "",
      professionalBody: "",
      authorizationAuthority: "",
      professionalRules: "",
      additionalLegalNote: "",
      dpoContact: ""
    },
    design: {
      heroImage: "",
      audio: "",
      modules: {
        video: { enabled: false, url: "" },
        contact: { enabled: true, email: "contact@example.com" }
      }
    }
  };
}

const { LegalNoticePage, PrivacyPage, CookiesPage } = loadPages();

test("English public legal pages render English labels without French section leakage", () => {
  const value = config("en");
  const text = [
    textContent(LegalNoticePage({ config: value, routeBase: "" })),
    textContent(PrivacyPage({ config: value, routeBase: "" })),
    textContent(CookiesPage({ config: value, routeBase: "" }))
  ].join(" ");

  assert.match(text, /Legal notice/);
  assert.match(text, /Website publisher/);
  assert.match(text, /Publication director/);
  assert.match(text, /Hosting provider/);
  assert.match(text, /Intellectual property/);
  assert.match(text, /Privacy policy/);
  assert.match(text, /Data controller/);
  assert.match(text, /Your rights/);
  assert.match(text, /Cookie information/);
  assert.match(text, /Default operation/);
  assert.match(text, /Browser settings/);
  assert.match(text, /Automatic compliance rule/);

  assert.doesNotMatch(text, /Mentions légales/);
  assert.doesNotMatch(text, /Éditeur du site/);
  assert.doesNotMatch(text, /Directeur de la publication/);
  assert.doesNotMatch(text, /Hébergeur/);
  assert.doesNotMatch(text, /Propriété intellectuelle/);
  assert.doesNotMatch(text, /Politique de confidentialité/);
  assert.doesNotMatch(text, /Responsable du traitement/);
  assert.doesNotMatch(text, /Vos droits/);
  assert.doesNotMatch(text, /Informations sur les cookies/);
  assert.doesNotMatch(text, /Fonctionnement par défaut/);
  assert.doesNotMatch(text, /Réglages du navigateur/);
  assert.doesNotMatch(text, /Règle automatique AJG/);
});

test("French public legal pages render French labels without English section leakage", () => {
  const value = config("fr");
  const text = [
    textContent(LegalNoticePage({ config: value, routeBase: "" })),
    textContent(PrivacyPage({ config: value, routeBase: "" })),
    textContent(CookiesPage({ config: value, routeBase: "" }))
  ].join(" ");

  assert.match(text, /Mentions légales/);
  assert.match(text, /Éditeur du site/);
  assert.match(text, /Directeur de la publication/);
  assert.match(text, /Hébergeur/);
  assert.match(text, /Propriété intellectuelle/);
  assert.match(text, /Politique de confidentialité/);
  assert.match(text, /Responsable du traitement/);
  assert.match(text, /Vos droits/);
  assert.match(text, /Informations sur les cookies/);
  assert.match(text, /Fonctionnement par défaut/);
  assert.match(text, /Réglages du navigateur/);
  assert.match(text, /Règle automatique AJG/);

  assert.doesNotMatch(text, /Website publisher/);
  assert.doesNotMatch(text, /Publication director/);
  assert.doesNotMatch(text, /Hosting provider/);
  assert.doesNotMatch(text, /Intellectual property/);
  assert.doesNotMatch(text, /Privacy policy/);
  assert.doesNotMatch(text, /Data controller/);
  assert.doesNotMatch(text, /Your rights/);
  assert.doesNotMatch(text, /Cookie information/);
  assert.doesNotMatch(text, /Default operation/);
  assert.doesNotMatch(text, /Browser settings/);
  assert.doesNotMatch(text, /Automatic compliance rule/);
});
