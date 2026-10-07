import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(
  new URL("../components/PricingPage.tsx", import.meta.url),
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

function loadPricingPage() {
  const jsx = (type, props) => ({ type, props: props || {} });
  const styles = new Proxy({}, { get: (_, key) => String(key) });
  const dependencies = {
    react: {
      useState(initial) {
        return [initial, () => undefined];
      }
    },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "next/link": "link",
    "./PricingPage.module.css": styles,
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
  return module.exports.PricingPage;
}

function textContent(tree) {
  if (tree === null || tree === undefined || typeof tree === "boolean") return "";
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  if (Array.isArray(tree)) return tree.map(textContent).join(" ");
  if (typeof tree === "object") return textContent(tree.props?.children);
  return "";
}

const PricingPage = loadPricingPage();

test("English pricing renders English commercial copy without French commercial leakage", () => {
  const tree = PricingPage({ locale: "en", annualIncludesLaunch: false });
  const text = textContent(tree);

  assert.equal(tree.props.lang, "en");
  assert.match(text, /Build\. Run\. Grow\./);
  assert.match(text, /Private beta · commercial payments still disabled/);
  assert.match(text, /Choose Essential/);
  assert.match(text, /Choose Growth/);
  assert.match(text, /Full AI Launch/);
  assert.match(text, /Legal notice/);
  assert.match(text, /Privacy/);
  assert.match(text, /Cancellation/);
  assert.match(text, /€15/);
  assert.match(text, /€29/);
  assert.match(text, /€49/);

  // "Français" is intentionally present only as the language-switch target.
  assert.doesNotMatch(text, /Créez\. Gérez\. Faites progresser\./);
  assert.doesNotMatch(text, /Bêta privée/);
  assert.doesNotMatch(text, /Choisir Essentiel/);
  assert.doesNotMatch(text, /Choisir Growth/);
  assert.doesNotMatch(text, /Mentions légales/);
  assert.doesNotMatch(text, /Confidentialité/);
  assert.doesNotMatch(text, /Résiliation/);
  assert.doesNotMatch(text, /Création IA disponible séparément/);
});

test("French pricing renders French commercial copy without English commercial leakage", () => {
  const tree = PricingPage({ locale: "fr", annualIncludesLaunch: false });
  const text = textContent(tree);

  assert.equal(tree.props.lang, "fr");
  assert.match(text, /Créez\. Gérez\. Faites progresser\./);
  assert.match(text, /Bêta privée · paiements commerciaux encore désactivés/);
  assert.match(text, /Choisir Essentiel/);
  assert.match(text, /Choisir Growth/);
  assert.match(text, /Création IA complète/);
  assert.match(text, /Mentions légales/);
  assert.match(text, /Confidentialité/);
  assert.match(text, /Résiliation/);
  assert.match(text, /15 €/);
  assert.match(text, /29 €/);
  assert.match(text, /49 €/);

  // "English" is intentionally present only as the language-switch target.
  assert.doesNotMatch(text, /Build\. Run\. Grow\./);
  assert.doesNotMatch(text, /Private beta/);
  assert.doesNotMatch(text, /Choose Essential/);
  assert.doesNotMatch(text, /Choose Growth/);
  assert.doesNotMatch(text, /Legal notice/);
  assert.doesNotMatch(text, /Cancellation/);
  assert.doesNotMatch(text, /AI Launch is available separately/);
});
