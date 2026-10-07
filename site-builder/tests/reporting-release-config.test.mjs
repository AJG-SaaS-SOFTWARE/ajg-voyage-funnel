import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
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
test("CLI blocks short credentials and redacts file secrets", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "ajg-reporting-test-"));
  try {
    const file = join(dir, "config.env");
    const secret = "synthetic-short-secret";
    writeFileSync(file, "AJG_COCKPIT_REPORTING_TOKEN=" + secret + "\nOTHER=synthetic-other-secret\n");
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/verify-reporting-config.mjs", import.meta.url)), file], { encoding: "utf8" });
    if (result.error?.code === "EPERM") {
      t.skip("current runtime blocks child-process execution");
      return;
    }
    assert.ifError(result.error);
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

test("provider validates sensitive production metadata without decrypting the secret", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ajg-provider-test-"));
  try {
    const metadata = join(dir, "metadata.json");

    writeFileSync(metadata, JSON.stringify({ envs: [] }));
    assert.deepEqual(await verifyReportingProvider(metadata), { status: "disabled" });

    writeFileSync(metadata, JSON.stringify({
      envs: [{
        id: "env_test",
        key: "AJG_COCKPIT_REPORTING_TOKEN",
        type: "sensitive",
        target: ["production"]
      }]
    }));
    assert.deepEqual(await verifyReportingProvider(metadata), { status: "ready" });

    for (const envs of [
      [
        { id: "env_a", key: "AJG_COCKPIT_REPORTING_TOKEN", type: "sensitive", target: ["production"] },
        { id: "env_b", key: "AJG_COCKPIT_REPORTING_TOKEN", type: "sensitive", target: ["production"] }
      ],
      [{ id: "env_test", key: "AJG_COCKPIT_REPORTING_TOKEN", type: "encrypted", target: ["production"] }],
      [{ key: "AJG_COCKPIT_REPORTING_TOKEN", type: "sensitive", target: ["production"] }]
    ]) {
      writeFileSync(metadata, JSON.stringify({ envs }));
      await assert.rejects(
        verifyReportingProvider(metadata),
        /^Error: reporting_configuration_preflight_failed$/
      );
    }

    writeFileSync(metadata, JSON.stringify({
      envs: [{
        id: "env_preview",
        key: "AJG_COCKPIT_REPORTING_TOKEN",
        type: "sensitive",
        target: ["preview"]
      }]
    }));
    assert.deepEqual(await verifyReportingProvider(metadata), { status: "disabled" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


test("production release validates sensitive reporting without decrypting it", () => {
  const workflow = readFileSync(
    new URL("../../.github/workflows/site-builder-production.yml", import.meta.url),
    "utf8"
  );
  const verifier = readFileSync(
    new URL("../scripts/verify-reporting-config.mjs", import.meta.url),
    "utf8"
  );

  assert.match(workflow, /decrypt=false/);
  assert.doesNotMatch(workflow, /decrypt=true/);
  assert.doesNotMatch(verifier, /decrypt["']?\s*,?\s*["']?true/);
  assert.match(workflow, /api\/health\/builder-reporting/);
  assert.match(workflow, /Verify Cockpit can read private Builder reporting/);
  assert.match(workflow, /no automatic rollback is requested for this integration failure/);
});
