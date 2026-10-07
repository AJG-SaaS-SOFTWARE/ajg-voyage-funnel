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
    if (ts.isConditionalExpression(current)) return true;
    if (ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current)) break;
    current = current.parent;
  }
  return false;
}

function displayedLiteral(node) {
  if (ts.isJsxText(node)) return node.getText();
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    if (ts.isJsxAttribute(node.parent)) return node.text;
    let current = node.parent;
    while (current && !ts.isJsxElement(current) && !ts.isJsxSelfClosingElement(current)) {
      if (ts.isJsxExpression(current)) return node.text;
      current = current.parent;
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
