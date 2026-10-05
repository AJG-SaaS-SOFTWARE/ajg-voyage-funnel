import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL("../lib/external-link-health.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText;
const module = { exports: {} };
new Function("require", "module", "exports", "fetch", code)(require, module, module.exports, globalThis.fetch);
const { isPublicIpAddress, isUnsafeExternalHostname, probeExternalLink } = module.exports;

test("external link guard rejects private and reserved network destinations", () => {
  assert.equal(isPublicIpAddress("8.8.8.8"), true);
  assert.equal(isPublicIpAddress("10.0.0.1"), false);
  assert.equal(isPublicIpAddress("127.0.0.1"), false);
  assert.equal(isPublicIpAddress("169.254.1.1"), false);
  assert.equal(isPublicIpAddress("192.168.1.10"), false);
  assert.equal(isPublicIpAddress("::1"), false);
  assert.equal(isPublicIpAddress("fd00::1"), false);
  assert.equal(isUnsafeExternalHostname("localhost"), true);
  assert.equal(isUnsafeExternalHostname("printer.local"), true);
  assert.equal(isUnsafeExternalHostname("example.com"), false);
});

test("external link probe marks a public successful destination reachable", async () => {
  const result = await probeExternalLink("https://example.com/path", {
    resolver: async () => [{ address: "93.184.216.34" }],
    fetcher: async () => new Response(null, { status: 200 }),
    timeoutMs: 500
  });
  assert.equal(result.state, "reachable");
  assert.equal(result.status, 200);
});

test("external link probe never follows a redirect into a private address", async () => {
  let calls = 0;
  const result = await probeExternalLink("https://example.com", {
    resolver: async () => [{ address: "93.184.216.34" }],
    fetcher: async () => {
      calls += 1;
      return new Response(null, {
        status: 302,
        headers: { location: "https://127.0.0.1/admin" }
      });
    },
    timeoutMs: 500
  });
  assert.equal(result.state, "unsafe");
  assert.equal(calls, 1);
});

test("external link probe treats a real 404 as unreachable without escalating to incident", async () => {
  const result = await probeExternalLink("https://example.com/missing", {
    resolver: async () => [{ address: "93.184.216.34" }],
    fetcher: async () => new Response(null, { status: 404 }),
    timeoutMs: 500
  });
  assert.equal(result.state, "unreachable");
  assert.equal(result.status, 404);
});
