import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import * as crypto from "node:crypto";

function load(fetcher) {
  const deadlines = [];
  const controller = new AbortController();
  const code = ts.transpileModule(fs.readFileSync(new URL("../lib/stripe-billing.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", "process", "fetch", "AbortSignal", code)(
    () => crypto, loaded, loaded.exports, { env: { STRIPE_RESTRICTED_KEY: "rk_test_synthetic" } }, fetcher,
    { timeout: ms => { deadlines.push(ms); return controller.signal; } }
  );
  return { request: loaded.exports.stripeRequest, deadlines, controller };
}

test("Stripe reads and mutations carry bounded deadlines without changing form encoding", async () => {
  const calls = [];
  const api = load(async (url, options) => {
    assert.equal(options.signal, api.controller.signal);
    calls.push({ url, options });
    return { ok: true, json: async () => ({ id: "synthetic" }) };
  });
  await api.request("/prices/price_synthetic", { method: "GET", params: { expand: ["product"] } });
  await api.request("/checkout/sessions", { params: { line_items: [{ price: "price_synthetic", quantity: 1 }] } });
  await api.request("/synthetic", { method: "DELETE" });
  assert.deepEqual(api.deadlines, [10000, 20000, 20000]);
  assert.equal(calls[0].url, "https://api.stripe.com/v1/prices/price_synthetic?expand%5B0%5D=product");
  assert.equal(new URLSearchParams(calls[1].options.body).get("line_items[0][quantity]"), "1");
  assert.equal(calls.length, 3);
});

test("a timed-out mutation fails explicitly and is never automatically repeated", async () => {
  let calls = 0;
  const api = load(async () => {
    calls++;
    api.controller.abort();
    throw new Error("private-provider-marker");
  });
  await assert.rejects(api.request("/checkout/sessions"), { message: "stripe_request_timeout" });
  assert.equal(calls, 1);
});

test("deadline expiry while reading the response body remains a timeout", async () => {
  const api = load(async () => ({ ok: true, json: async () => { api.controller.abort(); throw new Error("body interrupted"); } }));
  await assert.rejects(api.request("/billing_portal/sessions"), { message: "stripe_request_timeout" });
});

test("malformed successful provider responses cannot be treated as a valid session", async () => {
  for (const json of [async () => null, async () => [], async () => "invalid", async () => { throw new Error("invalid json"); }]) {
    await assert.rejects(load(async () => ({ ok: true, json })).request("/checkout/sessions"), { message: "stripe_response_invalid" });
  }
});

test("provider error codes and non-JSON HTTP failures keep their safe diagnostic", async () => {
  for (const [response, code] of [
    [{ ok: false, status: 400, json: async () => ({ error: { code: "resource_missing", message: "private marker" } }) }, "resource_missing"],
    [{ ok: false, status: 502, json: async () => { throw new Error("private marker"); } }, "stripe_http_502"]
  ]) {
    await assert.rejects(load(async () => response).request("/prices/synthetic", { method: "GET" }), { message: code, status: response.status });
  }
});
