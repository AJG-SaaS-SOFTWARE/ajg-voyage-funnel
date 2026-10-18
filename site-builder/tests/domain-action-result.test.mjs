import test from "node:test";
import assert from "node:assert/strict";
import { runDomainAction } from "../lib/domain-action-result.ts";

test("confirmed domain mutation is performed once and read back once", async () => {
  const calls = [];
  const result = await runDomainAction({
    mutate: async () => { calls.push("mutate"); return { verified: true }; },
    refresh: async () => { calls.push("read"); }
  });
  assert.deepEqual(result, { stage: "confirmed", value: { verified: true } });
  assert.deepEqual(calls, ["mutate", "read"]);
});

test("failed display refresh cannot turn an acknowledged mutation into a retry", async () => {
  let mutations = 0;
  const result = await runDomainAction({
    mutate: async () => { mutations++; return { id: "existing-domain" }; },
    refresh: async () => { throw new Error("read failed"); }
  });
  assert.deepEqual(result, { stage: "refresh_failed", value: { id: "existing-domain" } });
  assert.equal(mutations, 1);
});

test("a lost mutation response remains unconfirmed without replay or hidden read", async () => {
  const calls = [];
  const result = await runDomainAction({
    mutate: async () => { calls.push("server may have applied it"); throw new Error("timeout"); },
    refresh: async () => { calls.push("read"); }
  });
  assert.deepEqual(result, { stage: "mutation_unconfirmed" });
  assert.equal(calls.length, 1);
});
