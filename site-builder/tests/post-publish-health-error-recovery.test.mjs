import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../app/builder/page.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("builder.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function attribute(opening, name) {
  return opening.attributes.properties.find(property =>
    ts.isJsxAttribute(property) && property.name.getText(ast) === name
  );
}

test("the unavailable diagnostic keeps both recovery choices visible", () => {
  const candidates = [];
  function collect(node) {
    if (ts.isConditionalExpression(node) &&
        node.condition.getText(ast) === 'postPublishHealthState === "error"') {
      candidates.push(node);
    }
    ts.forEachChild(node, collect);
  }
  collect(ast);

  const errorBranch = candidates.find(candidate =>
    candidate.whenTrue.getText(ast).includes('href="/support"')
  );
  assert.ok(errorBranch, "expected the rendered post-publication error branch");

  const buttons = [];
  function collectButtons(node) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === "button") {
      buttons.push(node);
    }
    ts.forEachChild(node, collectButtons);
  }
  collectButtons(errorBranch.whenTrue);

  assert.equal(buttons.length, 1, "the error branch must expose one explicit retry");
  const opening = buttons[0].openingElement;
  assert.equal(attribute(opening, "type")?.initializer?.getText(ast), '"button"');
  assert.equal(attribute(opening, "className")?.initializer?.getText(ast), '"button secondary"');
  assert.equal(attribute(opening, "onClick")?.initializer?.getText(ast), "{retryPostPublishHealth}");
  assert.match(buttons[0].getText(ast), /tr\("Relancer le diagnostic", "Run diagnostic again"\)/);

  const branchText = errorBranch.whenTrue.getText(ast);
  assert.match(branchText, /href="\/support"/);
  assert.match(branchText, /tr\("Ouvrir le Health Center", "Open Health Center"\)/);
});
