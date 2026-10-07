import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const roots = ["app", "components"];
const excludedPrefixes = [
  path.normalize("app/admin"),
  path.normalize("app/api")
];

const bilingualEmergencyFallbacks = new Set([
  path.normalize("app/site/[slug]/error.tsx")
]);

const highRiskFrench =
  /\b(?:Accueil|Adresse|Aucun|Aucune|Annuler|Brouillon|Chargement|Connexion|Continuer|Corriger|Créer|Données|Domaine|Domaines|Enregistrer|Envoyer|Erreur|Facturation|Fermer|Français|Indisponible|Modifier|Navigateur|Prêt|Publié|Réessayer|Retour|Sauvegarder|Supprimer|Voir)\b/i;

const highRiskEnglish =
  /\b(?:Address|Back|Billing|Cancel|Close|Continue|Create|Data|Delete|Domain|Domains|Draft|Edit|Error|Fix|Home|Loading|Published|Ready|Retry|Save|Send|Sign in|Unavailable|View)\b/i;

const accentedFrench =
  /[àâçéèêëîïôùûüÿœæ]/i;

function customerTsxFiles() {
  const files = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const normalized = path.normalize(full);
      if (excludedPrefixes.some((prefix) => normalized === prefix || normalized.startsWith(prefix + path.sep))) continue;
      if (entry.isDirectory()) {
        visit(full);
      } else if (
        entry.isFile() &&
        full.endsWith(".tsx") &&
        !/Admin(?:Shell|Nav|Header|Panel)?\.tsx$/i.test(entry.name)
      ) {
        files.push(full);
      }
    }
  };
  for (const root of roots) visit(root);
  return files;
}

function localeDrivenCondition(condition) {
  const text = condition.getText();
  return /\b(?:locale|uiLocale|language|english|isEnglish|fr)\b/i.test(text);
}

function insideLocalizedContext(node) {
  let current = node.parent;
  while (current) {
    if (
      ts.isCallExpression(current) &&
      ts.isIdentifier(current.expression) &&
      current.expression.text === "tr"
    ) {
      return true;
    }
    if (ts.isConditionalExpression(current) && localeDrivenCondition(current.condition)) {
      return true;
    }
    if (ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current)) break;
    current = current.parent;
  }
  return false;
}

function displayedLiteral(node) {
  if (ts.isJsxText(node)) return node.getText();

  if (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isTemplateExpression(node)
  ) {
    if (ts.isJsxAttribute(node.parent)) {
      const name = node.parent.name.getText();
      if (["placeholder", "title", "aria-label", "alt"].includes(name)) {
        return ts.isTemplateExpression(node) ? node.getText() : node.text;
      }
      return null;
    }

    if (node.parent?.kind === ts.SyntaxKind.JsxExpression) {
      const attribute = node.parent.parent;
      if (attribute && ts.isJsxAttribute(attribute)) {
        const name = attribute.name.getText();
        return ["placeholder", "title", "aria-label", "alt"].includes(name)
          ? (ts.isTemplateExpression(node) ? node.getText() : node.text)
          : null;
      }
      return ts.isTemplateExpression(node) ? node.getText() : node.text;
    }
  }

  return null;
}

function languageLeakFindings(pattern) {
  const findings = [];

  for (const file of customerTsxFiles()) {
    const source = fs.readFileSync(file, "utf8");
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);

    const visit = (node) => {
      const literal = displayedLiteral(node);
      const normalizedFile = path.normalize(file);
      const languageSelectorLabel =
        (literal === "Français" || literal === "English") &&
        node.parent &&
        ts.isJsxElement(node.parent) &&
        node.parent.openingElement.tagName.getText() === "option";

      if (
        literal &&
        pattern.test(literal) &&
        !insideLocalizedContext(node) &&
        !languageSelectorLabel &&
        !bilingualEmergencyFallbacks.has(normalizedFile)
      ) {
        const { line } = ast.getLineAndCharacterOfPosition(node.getStart(ast));
        findings.push(`${file}:${line + 1}: ${literal.trim().slice(0, 120)}`);
      }
      ts.forEachChild(node, visit);
    };

    visit(ast);
  }

  return findings;
}

test("customer JSX has no high-risk raw French literals outside localization contexts", () => {
  const findings = languageLeakFindings(highRiskFrench);
  assert.deepEqual(
    findings,
    [],
    "Raw French customer-facing literals detected outside tr(...) or an explicit locale branch:\n" +
      findings.join("\n")
  );
});

test("customer JSX has no accented French literals outside localization contexts", () => {
  const findings = languageLeakFindings(accentedFrench);
  assert.deepEqual(
    findings,
    [],
    "Accented French customer-facing literals detected outside tr(...) or an explicit locale branch:\n" +
      findings.join("\n")
  );
});

test("customer JSX has no high-risk raw English literals outside localization contexts", () => {
  const findings = languageLeakFindings(highRiskEnglish);
  assert.deepEqual(
    findings,
    [],
    "Raw English customer-facing literals detected outside tr(...) or an explicit locale branch:\n" +
      findings.join("\n")
  );
});


test("public-site emergency error fallback is deliberately bilingual when site locale is unavailable", () => {
  const errorPage = fs.readFileSync("app/site/[slug]/error.tsx", "utf8");
  assert.match(errorPage, /Site momentanément indisponible · Website temporarily unavailable/);
  assert.match(errorPage, /Un service technique ne répond pas correctement/);
  assert.match(errorPage, /This website is temporarily unavailable/);
  assert.match(errorPage, /Réessayer · Try again/);
});

test("non-locale business ternaries are not treated as localization contexts", () => {
  const source = ts.createSourceFile(
    "synthetic.tsx",
    'const node = <span>{ready ? "Voir" : "Corriger"}</span>;',
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TSX
  );
  let protectedByLocale = false;
  const visit = (node) => {
    if (ts.isStringLiteral(node) && /Voir|Corriger/.test(node.text)) {
      protectedByLocale = insideLocalizedContext(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.equal(protectedByLocale, false);
});

test("locale-driven ternaries remain valid localization contexts", () => {
  const source = ts.createSourceFile(
    "synthetic.tsx",
    'const node = <span>{locale === "fr" ? "Voir" : "View"}</span>;',
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TSX
  );
  const results = [];
  const visit = (node) => {
    if (ts.isStringLiteral(node) && /Voir|View/.test(node.text)) {
      results.push(insideLocalizedContext(node));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.deepEqual(results, [true, true]);
});

test("template literals rendered directly in JSX are inspected", () => {
  const source = ts.createSourceFile(
    "synthetic.tsx",
    'const value = "x"; const node = <span>{`Voir ${value}`}</span>;',
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TSX
  );
  let literal = null;
  const visit = (node) => {
    if (ts.isTemplateExpression(node)) literal = displayedLiteral(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.match(literal || "", /Voir/);
});

test("template literals used only for non-visible JSX attributes are ignored", () => {
  const source = ts.createSourceFile(
    "synthetic.tsx",
    'const status = "ready"; const node = <span className={`billing-view ${status}`}>ok</span>;',
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TSX
  );
  let literal = "unset";
  const visit = (node) => {
    if (ts.isTemplateExpression(node)) literal = displayedLiteral(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.equal(literal, null);
});

test("template literals used for visible accessibility attributes remain inspected", () => {
  const source = ts.createSourceFile(
    "synthetic.tsx",
    'const value = "x"; const node = <span aria-label={`View ${value}`} />;',
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TSX
  );
  let literal = null;
  const visit = (node) => {
    if (ts.isTemplateExpression(node)) literal = displayedLiteral(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.match(literal || "", /View/);
});
