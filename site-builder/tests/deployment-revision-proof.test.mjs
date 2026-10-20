import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../scripts/verify-deployment.mjs", import.meta.url), "utf8");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const sha = "a".repeat(40);
const healthy = () => ({ ok: true, service: "ajg-site-builder", database: "ok", deployment: { commitSha: sha } });

async function run({ payload = healthy(), expected = sha, allowUnknown = false,
  base = "https://deployment.example.invalid", redirectAt = null, location = "",
  redirectStatus = 308, repeatRedirect = false } = {}) {
  const calls = [];
  const output = [];
  const argv = ["node", "verify-deployment.mjs", `--url=${base}`];
  if (expected !== null) argv.push(`--sha=${expected}`);
  if (allowUnknown) argv.push("--allow-unknown-sha");
  const redirected = new Set();
  const fetch = async (url, options) => {
    calls.push(String(url));
    assert.equal(options.redirect, "manual");
    const path = new URL(url).pathname;
    const key = `${url}|${options.headers?.["Accept-Language"] || ""}`;
    if (path === redirectAt && ((new URL(url).origin === base && !redirected.has(key)) || repeatRedirect)) {
      redirected.add(key);
      return new Response(null, { status: redirectStatus, headers: { location } });
    }
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

const canonical = "https://eltara.ajgsolutionsgroup.com";
const missingPath = "/ci-page-that-does-not-exist";

test("canonical HTTPS redirects preserve all existing public and FR/EN checks", async () => {
  for (const redirectStatus of [307, 308]) {
    for (const redirectAt of ["/login", "/plans", "/billing", "/tarifs", "/pricing", missingPath]) {
      const { output, calls } = await run({ redirectAt, redirectStatus, location: canonical + redirectAt });
      assert.equal(output[0].revisionVerified, true);
      if (redirectAt === missingPath) assert.equal(calls.filter(url => url === canonical + missingPath).length, 2);
    }
  }
});

test("unsafe public redirects cannot pass even when host and pathname match", async () => {
  for (const redirectAt of ["/login", "/plans", "/billing", "/tarifs", "/pricing"]) {
    for (const location of [
      `http://eltara.ajgsolutionsgroup.com${redirectAt}`,
      `${canonical}:8443${redirectAt}`, `${canonical}${redirectAt}?private-marker=hidden`,
      `${canonical}${redirectAt}#private-marker`,
      `https://user:private-marker@eltara.ajgsolutionsgroup.com${redirectAt}`
    ]) {
      await assert.rejects(run({ redirectAt, location }), error => {
        assert.equal(error.calls.filter(url => new URL(url).origin !== "https://deployment.example.invalid").length, 0);
        assert.equal(error.message.includes("private-marker"), false);
        return /unsafe canonical redirect/.test(error.message);
      });
    }
  }
});

test("localized 404 redirects reject unsafe destinations before following or echoing them", async () => {
  for (const location of [
    `http://eltara.ajgsolutionsgroup.com${missingPath}`, `${canonical}:8443${missingPath}`,
    `${canonical}${missingPath}?private-marker=hidden`, `${canonical}${missingPath}#private-marker`,
    `https://user:private-marker@eltara.ajgsolutionsgroup.com${missingPath}`,
    `https://outside.example.invalid${missingPath}?private-marker`, `${canonical}/wrong-path?private-marker`
  ]) {
    await assert.rejects(run({ redirectAt: missingPath, location }), error => {
      assert.equal(error.calls.filter(url => new URL(url).origin !== "https://deployment.example.invalid").length, 0);
      assert.equal(error.message.includes("private-marker"), false);
      return /unexpected canonical redirect/.test(error.message);
    });
  }
});

test("a second canonical redirect is not followed or counted as a localized 404", async () => {
  await assert.rejects(run({ redirectAt: missingPath, location: canonical + missingPath, repeatRedirect: true }), error => {
    assert.equal(error.calls.filter(url => url === canonical + missingPath).length, 1);
    return /expected 404/.test(error.message);
  });
});

test("same-origin relative redirects remain valid without broadening the canonical boundary", async () => {
  for (const redirectAt of ["/login", "/tarifs", missingPath]) {
    const { output } = await run({ base: canonical, redirectAt, location: redirectAt });
    assert.equal(output[0].revisionVerified, true);
  }
});
