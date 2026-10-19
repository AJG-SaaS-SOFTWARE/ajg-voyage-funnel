import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const workflow = fs.readFileSync(new URL("../../.github/workflows/site-builder-production.yml", import.meta.url), "utf8");
const sha = "a".repeat(40);
function success(mode) {
  return { ok: true, sha, mode, includeAi: mode === "full", executed: true, cleanupOk: true,
    plans: ["fr", "en"].map(locale => ({ locale, run: true, reason: "missing_validation" })),
    results: ["fr", "en"].map(locale => ({ locale, ok: true, status: 200, detail: "validated" })) };
}

// Execute the real workflow shell, replacing only curl with a local HTTP-200
// fixture. No provider, auth, email, payment or inference call can be made.
function runStep(mode, payload, raw) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eltara-release-gate-"));
  try {
    const name = mode === "full" ? "Run full AI FR/EN release E2E for deployed SHA" : "Run structural FR/EN release E2E for deployed SHA";
    const block = workflow.split(`      - name: ${name}\n`)[1]?.split("      - name:")[0];
    assert.ok(block, "release step exists");
    const script = block.split("        run: |\n")[1].split("\n").map(line => line.slice(10)).join("\n")
      .replaceAll(mode === "full" ? "/tmp/eltara-release-e2e.json" : "/tmp/eltara-release-e2e-structural.json", path.join(dir, "response.json"));
    fs.writeFileSync(path.join(dir, "fixture.json"), raw ?? JSON.stringify(payload));
    fs.writeFileSync(path.join(dir, "curl"), `#!${process.execPath}\nconst fs=require('node:fs'); const a=process.argv.slice(2); fs.copyFileSync(process.env.E2E_FIXTURE,a[a.indexOf('--output')+1]); process.stdout.write('200');\n`, { mode: 0o700 });
    return spawnSync("/bin/bash", ["-e", "-o", "pipefail", "-c", script], {
      cwd: root, encoding: "utf8", timeout: 10000,
      env: { PATH: `${dir}:${path.dirname(process.execPath)}:/usr/bin:/bin`,
        GITHUB_SHA: sha, PRODUCTION_ALIAS: "recipe.example.invalid", AJG_RELEASE_E2E_TOKEN: "synthetic",
        GITHUB_STEP_SUMMARY: path.join(dir, "summary"), E2E_FIXTURE: path.join(dir, "fixture.json") }
    });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

for (const mode of ["structural", "full"]) {
  test(`${mode}: actual release step accepts both successful locales and verified skips`, () => {
    const all = success(mode);
    const skipped = { ...all, executed: false, plans: all.plans.map(p => ({ ...p, run: false, reason: "already_validated" })) };
    delete skipped.cleanupOk; delete skipped.results;
    const mixed = success(mode);
    mixed.plans[0] = { locale: "fr", run: false, reason: "already_validated" };
    mixed.results.shift();
    for (const payload of [all, skipped, mixed]) {
      const result = runStep(mode, payload);
      assert.equal(result.status, 0, result.stderr);
    }
  });

  const invalid = {
    "provider blocked": p => ({ ...p, ok: false, executed: false, blocked: true, reason: "provider_blocked" }),
    "different deployment": p => ({ ...p, sha: "b".repeat(40) }),
    "different mode": p => ({ ...p, mode: mode === "full" ? "structural" : "full" }),
    "different AI policy": p => ({ ...p, includeAi: mode !== "full" }),
    "cooldown without validation": p => ({ ...p, executed: false, plans: p.plans.map(x => ({ ...x, run: false, reason: "cooldown" })), results: [] }),
    "exhausted retry budget": p => ({ ...p, executed: false, plans: p.plans.map(x => ({ ...x, run: false, reason: "retry_budget_exhausted" })), results: [] }),
    "one locale still cooling down": p => ({ ...p, plans: [{ locale: "fr", run: false, reason: "cooldown" }, p.plans[1]], results: [p.results[1]] }),
    "duplicate locale": p => ({ ...p, plans: [p.plans[0], p.plans[0]] }),
    "missing result": p => ({ ...p, results: [p.results[0]] }),
    "failed locale": p => ({ ...p, results: [{ ...p.results[0], ok: false }, p.results[1]] }),
    "failed cleanup": p => ({ ...p, cleanupOk: false }),
    "inconsistent execution": p => ({ ...p, executed: false })
  };
  for (const [name, mutate] of Object.entries(invalid)) {
    test(`${mode}: HTTP 200 cannot validate ${name}`, () => {
      const payload = mutate(success(mode)); payload.detail = "private-provider-marker";
      const result = runStep(mode, payload);
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.doesNotMatch(result.stdout + result.stderr, /private-provider-marker/);
    });
  }
  test(`${mode}: malformed JSON fails without printing the response`, () => {
    const result = runStep(mode, null, "private-provider-marker { invalid JSON");
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout + result.stderr, /private-provider-marker/);
  });
}
