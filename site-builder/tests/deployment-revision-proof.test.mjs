import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../scripts/verify-deployment.mjs", import.meta.url), "utf8");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const sha = "a".repeat(40);
const healthy = () => ({ ok: true, service: "ajg-site-builder", database: "ok", deployment: { commitSha: sha } });

async function run({ payload = healthy(), expected = sha, allowUnknown = false } = {}) {
  const calls = [];
  const output = [];
  const argv = ["node", "verify-deployment.mjs", "--url=https://deployment.example.invalid"];
  if (expected !== null) argv.push(`--sha=${expected}`);
  if (allowUnknown) argv.push("--allow-unknown-sha");
  const fetch = async (url, options) => {
    calls.push(String(url));
    assert.equal(options.redirect, "manual");
    const path = new URL(url).pathname;
    if (path === "/api/health") return Response.json(payload);
    if (path.startsWith("/api/")) return new Response(null, { status: path.includes("ci-route") ? 404 : path.includes("beta-followups") ? 405 : 401 });
    if (path.includes("ci-page")) {
      const locale = options.headers["Accept-Language"].startsWith("en") ? "en" : "fr";
      return new Response(`<html lang="${locale}">${locale === "en" ? "Page not found" : "Page introuvable"}`, { status: 404 });
    }
    if (path === "/tarifs" || path === "/pricing") {
      const fr = path === "/tarifs";
      return new Response(`<html lang="${fr ? "fr" : "en"}">${fr ? "Créez. Gérez. Faites progresser." : "Build. Run. Grow."}<a href="${fr ? "/mentions-legales" : "/legal"}">`, { headers: { "content-language": fr ? "fr" : "en" } });
    }
    return new Response("synthetic page");
  };
  try {
    await new AsyncFunction("fetch", "process", "console", source)(fetch,
      { argv, env: {}, exit() { throw Error("unexpected_exit"); } },
      { log: value => output.push(JSON.parse(value)), error() {} });
    return { calls, output };
  } catch (error) {
    error.calls = calls;
    throw error;
  }
}

test("deployment verification proves the exact requested full SHA and still runs all public checks", async () => {
  const { calls, output } = await run();
  assert.equal(output[0].revisionVerified, true);
  assert.equal(output[0].commitSha, sha);
  assert.equal(output[0].expectedSha, sha);
  assert.ok(calls.some(url => url.endsWith("/api/admin/managed-domains")));
});

test("short or malformed expected revisions fail before any network request", async () => {
  for (const expected of ["a", sha.slice(0, 7), sha + "a", "A".repeat(40), "z".repeat(40)]) {
    await assert.rejects(run({ expected }), error => error.calls.length === 0);
  }
});

test("missing, short, contradictory and malformed deployed revisions cannot certify a release", async () => {
  for (const commitSha of [null, undefined, "", "a", sha.slice(0, 7), sha + "a", "b".repeat(40), true, 123, {}, []]) {
    const payload = healthy(); payload.deployment.commitSha = commitSha;
    await assert.rejects(run({ payload }), error => error.calls.length === 1);
  }
});

test("explicit unknown-SHA inspection never claims revision verification", async () => {
  for (const commitSha of [null, undefined, ""]) {
    const payload = healthy(); payload.deployment.commitSha = commitSha;
    const { output } = await run({ payload, allowUnknown: true });
    assert.equal(output[0].revisionVerified, false);
    assert.equal(output[0].commitSha, null);
    assert.equal(output[0].expectedSha, sha);
  }
});

test("unknown-SHA option does not waive a malformed or wrong revision", async () => {
  for (const commitSha of ["a", true, "b".repeat(40)]) {
    const payload = healthy(); payload.deployment.commitSha = commitSha;
    await assert.rejects(run({ payload, allowUnknown: true }));
  }
});

test("omitting the expected revision is only a health and route inspection", async () => {
  const { output } = await run({ expected: null });
  assert.equal(output[0].revisionVerified, false);
  assert.equal(output[0].expectedSha, null);
});

test("HTTP 200 with truthy success, another service or unavailable database stops before route checks", async () => {
  for (const payload of [{ ...healthy(), ok: "true" }, { ...healthy(), ok: 1 },
    { ...healthy(), service: "another-service" }, { ...healthy(), service: undefined },
    { ...healthy(), database: "unavailable" }, null, []]) {
    await assert.rejects(run({ payload }), error => error.calls.length === 1);
  }
});
