import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateReportingConfiguration, verifyReportingFile, verifyReportingProvider } from "../scripts/verify-reporting-config.mjs";

test("unconfigured reporting stays explicitly disabled", () => {
  assert.deepEqual(validateReportingConfiguration({}), { status: "disabled" });
  assert.deepEqual(validateReportingConfiguration({ AJG_COCKPIT_REPORTING_TOKEN: "" }), { status: "disabled" });
});
test("only a configured 32-character token is ready", () => {
  assert.deepEqual(validateReportingConfiguration({ AJG_COCKPIT_REPORTING_TOKEN: "x".repeat(32) }), { status: "ready" });
  for (const value of ["x".repeat(24), "x".repeat(31), " ".repeat(32), 123]) {
    assert.throws(() => validateReportingConfiguration({ AJG_COCKPIT_REPORTING_TOKEN: value }), /configuration_invalid/);
  }
});
test("configuration file is parsed without executing shell expressions", () => {
  const dir = mkdtempSync(join(tmpdir(), "ajg-reporting-test-"));
  try {
    const file = join(dir, "config.env");
    writeFileSync(file, 'AJG_COCKPIT_REPORTING_TOKEN="' + "x".repeat(32) + '"\nOTHER="$(exit 1)"\n');
    assert.deepEqual(verifyReportingFile(file), { status: "ready" });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test("CLI blocks short credentials and redacts file secrets", () => {
  const dir = mkdtempSync(join(tmpdir(), "ajg-reporting-test-"));
  try {
    const file = join(dir, "config.env");
    const secret = "synthetic-short-secret";
    writeFileSync(file, "AJG_COCKPIT_REPORTING_TOKEN=" + secret + "\nOTHER=synthetic-other-secret\n");
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/verify-reporting-config.mjs", import.meta.url)), file], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout + result.stderr, /synthetic-short-secret|synthetic-other-secret/);
    assert.match(result.stderr, /publication blocked/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test("unreadable configuration cannot count as disabled", () => {
  assert.throws(() => verifyReportingFile("/definitely-missing/ajg-reporting.env"), /preflight_failed/);
});


test("configured but withheld credentials block release", () => {
  const dir = mkdtempSync(join(tmpdir(), "ajg-reporting-test-"));
  try {
    const file = join(dir, "config.env");
    const metadata = join(dir, "metadata.json");
    writeFileSync(file, "OTHER=synthetic-value\n");
    writeFileSync(metadata, JSON.stringify({ envs: [{ key: "AJG_COCKPIT_REPORTING_TOKEN", target: ["production"] }] }));
    assert.throws(() => verifyReportingFile(file, metadata), /preflight_failed/);
    writeFileSync(metadata, JSON.stringify({ envs: [] }));
    assert.deepEqual(verifyReportingFile(file, metadata), { status: "disabled" });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("provider verifies only reporting and fails closed without disclosing errors", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ajg-provider-test-"));
  try {
    const metadata = join(dir, "metadata.json");
    const env = { VERCEL_TOKEN: "synthetic-provider-secret", VERCEL_PROJECT_ID: "prj_test", VERCEL_ORG_ID: "team_test" };
    writeFileSync(metadata, JSON.stringify({ envs: [] }));
    assert.deepEqual(await verifyReportingProvider(metadata, {}, () => { throw new Error("must not fetch"); }), { status: "disabled" });
    writeFileSync(metadata, JSON.stringify({ envs: [{ id: "env_test", key: "AJG_COCKPIT_REPORTING_TOKEN", target: ["production"] }] }));
    const request = async (url, options) => {
      assert.equal(url.pathname, "/v1/projects/prj_test/env/env_test");
      assert.equal(url.searchParams.get("teamId"), "team_test");
      assert.equal(options.headers.Authorization, "Bearer " + env.VERCEL_TOKEN);
      assert.ok(options.signal);
      return { ok: true, json: async () => ({ key: "AJG_COCKPIT_REPORTING_TOKEN", decrypted: true, value: "x".repeat(32) }) };
    };
    assert.deepEqual(await verifyReportingProvider(metadata, env, request), { status: "ready" });
    for (const row of [{ decrypted: false, value: "x".repeat(32) }, { decrypted: true, value: "short" }, { decrypted: true }]) {
      await assert.rejects(verifyReportingProvider(metadata, env, async () => ({ ok: true, json: async () => ({ key: "AJG_COCKPIT_REPORTING_TOKEN", ...row }) })), /^Error: reporting_configuration_preflight_failed$/);
    }
    await assert.rejects(verifyReportingProvider(metadata, env, async () => ({ ok: false })), /preflight_failed/);
    await assert.rejects(verifyReportingProvider(metadata, env, async () => { throw new Error(env.VERCEL_TOKEN); }), /^Error: reporting_configuration_preflight_failed$/);
    await assert.rejects(verifyReportingProvider(metadata, {}, request), /preflight_failed/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
