import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(
  new URL("../components/AccountShell.tsx", import.meta.url),
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

function loadAccountShell() {
  const jsx = (type, props) => ({ type, props: props || {} });
  const dependencies = {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "next/link": "link",
    "../lib/product-i18n": {
      useProductLocale: () => ({
        locale: currentLocale,
        tr: (fr, en) => currentLocale === "en" ? en : fr
      })
    },
    "./LanguageSwitch": { LanguageSwitch: "language-switch" },
    "./EltaraBrand": { EltaraBrand: "eltara-brand" }
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
  return module.exports.AccountShell;
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

const AccountShell = loadAccountShell();

function render(locale, active) {
  currentLocale = locale;
  return AccountShell({
    active,
    eyebrow: "TEST",
    title: "TEST",
    description: "TEST",
    children: { type: "child", props: { children: "CONTENT" } }
  });
}

test("English account shell renders English navigation for billing/domain/data journeys", () => {
  for (const active of ["billing", "domains", "data"]) {
    const tree = render("en", active);
    const text = textContent(tree);

    assert.match(text, /Open ELTARA/);
    assert.match(text, /Product/);
    assert.match(text, /Your account/);
    assert.match(text, /My plan/);
    assert.match(text, /Billing/);
    assert.match(text, /Domains/);
    assert.match(text, /My data/);
    assert.match(text, /Help for this screen/);
    assert.match(text, /Pricing · compare plans/);
    assert.match(text, /Essential, Growth and AI Launch/);

    assert.doesNotMatch(text, /Ouvrir ELTARA/);
    assert.doesNotMatch(text, /Votre compte/);
    assert.doesNotMatch(text, /Mon offre/);
    assert.doesNotMatch(text, /Facturation/);
    assert.doesNotMatch(text, /Domaines/);
    assert.doesNotMatch(text, /Mes données/);
    assert.doesNotMatch(text, /Aide liée à cet écran/);
    assert.doesNotMatch(text, /Tarifs · comparer les offres/);
  }

  assert.match(textContent(render("en", "billing")), /Resolve a billing issue/);
  assert.match(textContent(render("en", "domains")), /Domain & DNS help/);
  assert.match(textContent(render("en", "data")), /Export & data help/);

  const hrefs = nodes(render("en", "billing"))
    .filter((node) => node.type === "link")
    .map((node) => node.props.href);
  assert.ok(hrefs.includes("/pricing"));
  assert.ok(!hrefs.includes("/tarifs"));
});

test("French account shell renders French navigation for billing/domain/data journeys", () => {
  for (const active of ["billing", "domains", "data"]) {
    const tree = render("fr", active);
    const text = textContent(tree);

    assert.match(text, /Ouvrir ELTARA/);
    assert.match(text, /Produit/);
    assert.match(text, /Votre compte/);
    assert.match(text, /Mon offre/);
    assert.match(text, /Facturation/);
    assert.match(text, /Domaines/);
    assert.match(text, /Mes données/);
    assert.match(text, /Aide liée à cet écran/);
    assert.match(text, /Tarifs · comparer les offres/);
    assert.match(text, /Essentiel, Growth et Création IA/);

    assert.doesNotMatch(text, /Open ELTARA/);
    assert.doesNotMatch(text, /Your account/);
    assert.doesNotMatch(text, /My plan/);
    assert.doesNotMatch(text, /My data/);
    assert.doesNotMatch(text, /Help for this screen/);
    assert.doesNotMatch(text, /Pricing · compare plans/);
  }

  assert.match(textContent(render("fr", "billing")), /Résoudre un problème de facturation/);
  assert.match(textContent(render("fr", "domains")), /Aide domaine & DNS/);
  assert.match(textContent(render("fr", "data")), /Aide export & données/);

  const hrefs = nodes(render("fr", "billing"))
    .filter((node) => node.type === "link")
    .map((node) => node.props.href);
  assert.ok(hrefs.includes("/tarifs"));
  assert.ok(!hrefs.includes("/pricing"));
});
