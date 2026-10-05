import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL("../lib/external-link-health.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const module = { exports: {} };
new Function("require", "module", "exports", code)(require, module, module.exports);
const { isPublicAddress, safeHttpsUrl } = module.exports;

test("external link guard rejects local and private network destinations", () => {
  assert.equal(isPublicAddress("127.0.0.1"), false);
  assert.equal(isPublicAddress("10.1.2.3"), false);
  assert.equal(isPublicAddress("192.168.1.10"), false);
  assert.equal(isPublicAddress("172.20.0.5"), false);
  assert.equal(isPublicAddress("169.254.1.1"), false);
  assert.equal(isPublicAddress("::1"), false);
  assert.equal(isPublicAddress("fc00::1"), false);
});

test("external link guard accepts public HTTPS and rejects unsafe URL forms", () => {
  assert.ok(safeHttpsUrl("https://example.com/path"));
  assert.equal(safeHttpsUrl("http://example.com"), null);
  assert.equal(safeHttpsUrl("https://localhost/test"), null);
  assert.equal(safeHttpsUrl("https://127.0.0.1/test"), null);
  assert.equal(safeHttpsUrl("https://user:pass@example.com"), null);
  assert.equal(safeHttpsUrl("https://example.com:8443"), null);
});
