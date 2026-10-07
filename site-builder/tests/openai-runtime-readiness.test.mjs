import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/openai-readiness.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

function loadModule() {
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(() => ({}), module, module.exports);
  return module.exports;
}

test("OpenAI credential and billing failures are classified as provider unavailability", () => {
  const { isOpenAiUnavailableError } = loadModule();

  for (const code of [
    "expired_secret_key",
    "invalid_api_key",
    "invalid_authentication",
    "authentication_error",
    "credit_balance_exhausted",
    "insufficient_quota",
    "billing_hard_limit_reached"
  ]) {
    assert.equal(isOpenAiUnavailableError(code, 400), true, code);
  }

  assert.equal(isOpenAiUnavailableError("unknown", 401), true);
  assert.equal(isOpenAiUnavailableError("unknown", 403), true);
  assert.equal(isOpenAiUnavailableError("unknown", 429), false);
});

test("OpenAI runtime audit blocks a missing key without calling the provider", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  delete process.env.OPENAI_API_KEY;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    throw new Error("provider should not be called");
  };

  try {
    const { auditOpenAiRuntime } = loadModule();
    const result = await auditOpenAiRuntime();
    assert.equal(result.status, "blocker");
    assert.match(result.detail, /OPENAI_API_KEY/);
    assert.equal(called, false);
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    globalThis.fetch = previousFetch;
  }
});

test("OpenAI runtime audit blocks expired credentials without exposing provider messages", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "synthetic-secret";
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.Authorization, "Bearer synthetic-secret");
    return {
      ok: false,
      status: 401,
      json: async () => ({
        error: {
          code: "expired_secret_key",
          message: "SENSITIVE PROVIDER MESSAGE"
        }
      })
    };
  };

  try {
    const { auditOpenAiRuntime } = loadModule();
    const result = await auditOpenAiRuntime();
    assert.equal(result.status, "blocker");
    assert.match(result.detail, /rotation manuelle/i);
    assert.doesNotMatch(result.detail, /SENSITIVE PROVIDER MESSAGE/);
    assert.doesNotMatch(result.detail, /synthetic-secret/);
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    globalThis.fetch = previousFetch;
  }
});

test("OpenAI runtime audit passes a successful read-only provider probe", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "synthetic-secret";
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/models");
    assert.equal(options.method, "GET");
    return { ok: true, status: 200, json: async () => ({ data: [] }) };
  };

  try {
    const { auditOpenAiRuntime } = loadModule();
    const result = await auditOpenAiRuntime();
    assert.equal(result.status, "pass");
    assert.match(result.detail, /read-only/);
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    globalThis.fetch = previousFetch;
  }
});

test("AI route and release readiness share the provider-unavailability contract", () => {
  const writer = fs.readFileSync(new URL("../app/api/ai/write/route.ts", import.meta.url), "utf8");
  const readiness = fs.readFileSync(new URL("../app/api/admin/release-readiness/route.ts", import.meta.url), "utf8");

  assert.match(writer, /isOpenAiUnavailableError\(\s*error\.code,\s*error\.status\s*\)/);
  assert.match(writer, /isOpenAiUnavailableError\(code, response\.status\)/);
  assert.match(readiness, /auditOpenAiRuntimeCached\(\)/);
  assert.doesNotMatch(readiness, /present\(process\.env\.OPENAI_API_KEY\)/);
});
