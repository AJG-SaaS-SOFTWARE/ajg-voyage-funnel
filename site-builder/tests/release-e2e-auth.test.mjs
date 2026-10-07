import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL("../lib/release-e2e-auth.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const module = { exports: {} };
new Function("require", "module", "exports", code)(require, module, module.exports);
const { releaseE2EAuthorized } = module.exports;

function request(token) {
  return new Request("https://eltara.example/api/cron/release-e2e", {
    headers: token ? { authorization: `Bearer ${token}` } : {}
  });
}

test("release E2E auth preserves normal Vercel CRON_SECRET authorization", () => {
  const previousCron = process.env.CRON_SECRET;
  const previousHash = process.env.AJG_RELEASE_E2E_TOKEN_HASH;
  try {
    process.env.CRON_SECRET = "cron-secret-test-value";
    delete process.env.AJG_RELEASE_E2E_TOKEN_HASH;
    assert.equal(releaseE2EAuthorized(request("cron-secret-test-value")), true);
    assert.equal(releaseE2EAuthorized(request("wrong-value")), false);
  } finally {
    if (previousCron === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousCron;
    if (previousHash === undefined) delete process.env.AJG_RELEASE_E2E_TOKEN_HASH;
    else process.env.AJG_RELEASE_E2E_TOKEN_HASH = previousHash;
  }
});

test("release E2E auth accepts only a token matching the ephemeral SHA-256 hash", () => {
  const previousCron = process.env.CRON_SECRET;
  const previousHash = process.env.AJG_RELEASE_E2E_TOKEN_HASH;
  try {
    delete process.env.CRON_SECRET;
    const token = "ephemeral-release-token-for-test";
    process.env.AJG_RELEASE_E2E_TOKEN_HASH = createHash("sha256").update(token).digest("hex");
    assert.equal(releaseE2EAuthorized(request(token)), true);
    assert.equal(releaseE2EAuthorized(request("wrong-value")), false);
    assert.equal(releaseE2EAuthorized(request("")), false);

    process.env.AJG_RELEASE_E2E_TOKEN_HASH = "not-a-valid-sha256";
    assert.equal(releaseE2EAuthorized(request(token)), false);
  } finally {
    if (previousCron === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousCron;
    if (previousHash === undefined) delete process.env.AJG_RELEASE_E2E_TOKEN_HASH;
    else process.env.AJG_RELEASE_E2E_TOKEN_HASH = previousHash;
  }
});
