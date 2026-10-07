import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(
  new URL("../app/login/page.tsx", import.meta.url),
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

let currentLocale = "fr";

function loadLoginPage() {
  const jsx = (type, props) => ({ type, props: props || {} });
  const dependencies = {
    react: {
      useState(initial) {
        return [initial, () => undefined];
      },
      useEffect() {}
    },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "next/link": "link",
    "next/navigation": { useRouter: () => ({ replace() {} }) },
    "../../lib/supabase-browser": {
      getSupabaseBrowserClient: () => null,
      isSupabaseConfigured: () => true
    },
    "../../lib/product-i18n": {
      useProductLocale: () => ({
        locale: currentLocale,
        tr: (fr, en) => currentLocale === "en" ? en : fr
      })
    },
    "../../components/LanguageSwitch": { LanguageSwitch: "language-switch" },
    "../../components/EltaraBrand": { EltaraBrand: "eltara-brand" },
    "../../lib/private-beta-access": { getPrivateBetaAccess: async () => null }
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
  return module.exports.default;
}

function textContent(tree) {
  if (tree === null || tree === undefined || typeof tree === "boolean") return "";
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  if (Array.isArray(tree)) return tree.map(textContent).join(" ");
  if (typeof tree === "object") return textContent(tree.props?.children);
  return "";
}

function nodes(tree) {
  if (tree === null || tree === undefined || typeof tree === "boolean") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (typeof tree === "object") return [tree, ...nodes(tree.props?.children)];
  return [];
}

const LoginPage = loadLoginPage();

function render(locale) {
  currentLocale = locale;
  return LoginPage();
}

test("English login renders an invitation-only English journey", () => {
  const tree = render("en");
  const text = textContent(tree);

  assert.match(text, /Guided creation · simplified publishing/);
  assert.match(text, /Build your online presence without starting from scratch/);
  assert.match(text, /Centralized compliance/);
  assert.match(text, /Passwordless sign-in/);
  assert.match(text, /Private beta · invitation only/);
  assert.match(text, /Sign in/);
  assert.match(text, /Email address/);
  assert.match(text, /Send me a sign-in link/);
  assert.match(text, /Back to home/);
  assert.match(text, /Administrator access/);

  assert.doesNotMatch(text, /Création guidée/);
  assert.doesNotMatch(text, /Créez votre présence/);
  assert.doesNotMatch(text, /Conformité centralisée/);
  assert.doesNotMatch(text, /Connexion sans mot de passe/);
  assert.doesNotMatch(text, /Bêta privée/);
  assert.doesNotMatch(text, /Adresse email/);
  assert.doesNotMatch(text, /Recevoir mon lien de connexion/);
  assert.doesNotMatch(text, /Retour à l’accueil/);
  assert.doesNotMatch(text, /Accès administrateur/);

  const input = nodes(tree).find((node) => node.type === "input");
  assert.equal(input?.props.placeholder, "you@example.com");
});

test("French login renders an invitation-only French journey", () => {
  const tree = render("fr");
  const text = textContent(tree);

  assert.match(text, /Création guidée · publication simplifiée/);
  assert.match(text, /Créez votre présence en ligne sans partir de zéro/);
  assert.match(text, /Conformité centralisée/);
  assert.match(text, /Connexion sans mot de passe/);
  assert.match(text, /Bêta privée · sur invitation/);
  assert.match(text, /Connexion/);
  assert.match(text, /Adresse email/);
  assert.match(text, /Recevoir mon lien de connexion/);
  assert.match(text, /Retour à l’accueil/);
  assert.match(text, /Accès administrateur/);

  assert.doesNotMatch(text, /Guided creation/);
  assert.doesNotMatch(text, /Build your online presence/);
  assert.doesNotMatch(text, /Centralized compliance/);
  assert.doesNotMatch(text, /Passwordless sign-in/);
  assert.doesNotMatch(text, /Private beta · invitation only/);
  assert.doesNotMatch(text, /Email address/);
  assert.doesNotMatch(text, /Send me a sign-in link/);
  assert.doesNotMatch(text, /Back to home/);
  assert.doesNotMatch(text, /Administrator access/);

  const input = nodes(tree).find((node) => node.type === "input");
  assert.equal(input?.props.placeholder, "vous@exemple.fr");
});
