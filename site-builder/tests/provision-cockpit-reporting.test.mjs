import test from "node:test";
import assert from "node:assert/strict";
import { provisionReporting, selectSharedToken } from "../scripts/provision-cockpit-reporting.mjs";

test("shared reporting secret preserves existing credentials and rejects conflicts", () => {
  const secret = "x".repeat(64);
  assert.equal(selectSharedToken([null, null], () => secret), secret);
  assert.equal(selectSharedToken([secret, null]), secret);
  assert.equal(selectSharedToken([null, secret]), secret);
  assert.equal(selectSharedToken([secret, secret]), secret);
  assert.throws(() => selectSharedToken([secret, "y".repeat(64)]), /conflict/);
  assert.throws(() => selectSharedToken(["short", null]), /invalid/);
});
test("provisioning creates only missing production keys, verifies and is idempotent", async () => {
  const stored = new Map(); const mutations = [];
  const request = async (url, options) => {
    assert.equal(url.origin, "https://api.vercel.com");
    assert.equal(options.redirect, "error"); assert.ok(options.signal);
    const project = url.pathname.split("/")[3];
    if (options.method === "POST") {
      const body = JSON.parse(options.body); mutations.push(body);
      assert.equal(body.type, "encrypted"); assert.deepEqual(body.target, ["production"]);
      stored.set(project, { ...body, id: "env_test" });
      return { ok: true, json: async () => ({ created: {} }) };
    }
    const row = stored.get(project);
    return { ok: true, json: async () => url.pathname.endsWith("env")
      ? { envs: row ? [{ id: row.id, key: row.key, target: row.target }] : [] }
      : { ...row, decrypted: true } };
  };
  assert.deepEqual(await provisionReporting("synthetic-provider-key", request), { configured: true });
  assert.equal(mutations.length, 2); assert.equal(mutations[0].value, mutations[1].value);
  assert.equal(mutations[0].value.length, 64);
  await provisionReporting("synthetic-provider-key", request); assert.equal(mutations.length, 2);
});
test("provider denial cannot be mistaken for an absent secret", async () => {
  const calls = [];
  await assert.rejects(provisionReporting("synthetic", async (url, options) => {
    calls.push(options.method); return { ok: false };
  }), /access_failed/);
  assert.ok(calls.every(method => method === "GET"));
});
