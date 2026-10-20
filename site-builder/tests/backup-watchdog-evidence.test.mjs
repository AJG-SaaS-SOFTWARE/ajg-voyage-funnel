import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { inspectBackupEvidence, recoveredBackupEvidence } from "../scripts/verify-backup-watchdog-evidence.mjs";

const now = Date.parse("2026-10-20T01:00:00Z");
const at = hours => new Date(now - hours * 3_600_000).toISOString();
const payload = (hours = 2, status = "healthy") => ({
  ok: true, configured: true, status, lastCompletedAt: at(hours), ageHours: hours
});

for (const change of [null, {}, { ok: false }, { configured: false }, { configured: "true" },
  { status: "unknown", ageHours: null }, { ageHours: null }, { ageHours: "2" },
  { ageHours: false }, { ageHours: NaN }, { ageHours: Infinity }, { ageHours: -1 },
  { lastCompletedAt: null }, { lastCompletedAt: "" }, { lastCompletedAt: "bad" },
  { lastCompletedAt: 1 }, { lastCompletedAt: at(-0.001), ageHours: 0 },
  { lastCompletedAt: at(100) }, { status: "critical" }, { status: "warning" },
  { ageHours: 99 }, { ageHours: 2.11 }]) {
  test(`watchdog blocks absent or inconsistent evidence: ${JSON.stringify(change)}`, () => {
    const value = change === null ? null : Object.keys(change).length ? { ...payload(), ...change } : {};
    assert.equal(inspectBackupEvidence(value, now).decision, "blocked");
  });
}

test("watchdog retains 36h recovery trigger and known stale states", () => {
  for (const [hours, status, decision] of [[0,"healthy","fresh"], [35.999,"healthy","fresh"],
    [36,"healthy","recover"], [36.001,"warning","recover"], [72,"warning","recover"], [73,"critical","recover"]]) {
    const value = { ...payload(hours, status), ageHours: Math.round(hours * 10) / 10 };
    assert.equal(inspectBackupEvidence(value, now).decision, decision);
  }
});

test("public one-decimal age and 60s cache are tolerated, not future completion", () => {
  const value = { ...payload(36.04, "healthy"), ageHours: 36 };
  assert.equal(inspectBackupEvidence(value, now).decision, "recover");
  assert.equal(inspectBackupEvidence({ ...payload(), ageHours: 1.95 }, now).decision, "fresh");
  for (const clock of [NaN, Infinity, -1, now + 0.5, 8.64e15 + 1, "now", null]) {
    assert.equal(inspectBackupEvidence(payload(), clock).decision, "blocked");
  }
});

test("recovery requires chronological progress and fresh positive evidence", () => {
  const previous = at(48);
  assert.equal(recoveredBackupEvidence(payload(), previous, now), true);
  for (const value of [payload(48,"warning"), payload(49,"warning"), payload(37,"warning"),
    payload(-1), { ...payload(), status: "unknown" }, { ...payload(), ageHours: null }]) {
    assert.equal(recoveredBackupEvidence(value, previous, now), false);
  }
  for (const previous of [null, "bad", at(1), at(-1), at(2), "2026-10-19T23:00:00+00:00"]) {
    assert.equal(recoveredBackupEvidence(payload(), previous, now), false);
  }
});

test("CLI emits canonical output only, and fails closed without leaking source JSON", () => {
  const dir = mkdtempSync(join(tmpdir(), "eltara-backup-evidence-"));
  const file = join(dir, "status.json");
  const script = new URL("../scripts/verify-backup-watchdog-evidence.mjs", import.meta.url);
  const cli = (...args) => spawnSync(process.execPath, [script.pathname, ...args], { encoding: "utf8" });
  try {
    const current = Date.now();
    const recent = new Date(current - 3_600_000).toISOString();
    writeFileSync(file, JSON.stringify({ ...payload(), lastCompletedAt: recent, ageHours: 1 }));
    const good = cli("check", file);
    assert.equal(good.status, 0); assert.match(good.stdout, /^needs_recovery=false\nlast_completed_at=\d{4}-[^\n]+Z\nage_hours=[\d.]+\n$/);
    assert.equal(cli("verify", file, new Date(current - 48 * 3_600_000).toISOString()).status, 0);
    for (const value of ['{"private":"sensitive marker"', JSON.stringify({ ...payload(),
      lastCompletedAt: "sensitive marker\nneeds_recovery=true", status: "unknown", ageHours: null })]) {
      writeFileSync(file, value);
      const bad = cli("check", file);
      assert.equal(bad.status, 1); assert.equal(bad.stdout, "");
      assert.doesNotMatch(bad.stderr, /sensitive marker|needs_recovery=true/);
      assert.equal(cli("verify", file, at(48)).status, 1);
    }
    assert.equal(cli("invalid", file).status, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("actual watchdog check step fails closed before any recovery output", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/eltara-storage-backup-watchdog.yml", import.meta.url), "utf8");
  const block = workflow.match(/      - name: Check backup freshness[\s\S]*?        run: \|\n([\s\S]*?)(?=\n      - name:)/)[1];
  const dir = mkdtempSync(join(tmpdir(), "eltara-watchdog-step-"));
  const output = join(dir, "outputs");
  const command = 'curl() { printf "%s" "$FIXTURE_BODY"; };\n' +
    block.replace(/^          /gm, "").replaceAll("/tmp/storage-backup-health.json", join(dir, "health.json"));
  try {
    const current = Date.now();
    for (const [value, expected] of [
      [{ ...payload(), lastCompletedAt: new Date(current - 3_600_000).toISOString(), ageHours: 1 }, "false"],
      [{ ...payload(48,"warning"), lastCompletedAt: new Date(current - 48 * 3_600_000).toISOString() }, "true"],
      [{ ...payload(), status: "unknown", ageHours: null }, null],
      [{ ...payload(), lastCompletedAt: "injected\nneeds_recovery=true" }, null]
    ]) {
      writeFileSync(output, "");
      const result = spawnSync("bash", ["-e", "-c", command], {
        cwd: new URL("../../", import.meta.url), encoding: "utf8",
        env: { ...process.env, FIXTURE_BODY: JSON.stringify(value), GITHUB_OUTPUT: output,
          PRODUCTION_ALIAS: "fixture.example.invalid" }
      });
      const emitted = readFileSync(output,"utf8");
      if (expected === null) {
        assert.notEqual(result.status, 0); assert.equal(emitted, "");
      } else {
        assert.equal(result.status, 0, result.stderr);
        assert.match(emitted, new RegExp(`^needs_recovery=${expected}\\n`));
      }
      assert.doesNotMatch(result.stderr + emitted, /injected/);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("actual post-recovery step rejects changed-but-unconfirmed completions", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/eltara-storage-backup-watchdog.yml", import.meta.url), "utf8");
  const block = workflow.match(/      - name: Verify recovery produced a newer backup[\s\S]*?        run: \|\n([\s\S]*)$/)[1];
  const dir = mkdtempSync(join(tmpdir(), "eltara-watchdog-recovery-"));
  const summary = join(dir, "summary");
  const command = 'curl() { printf "%s" "$FIXTURE_BODY"; }; sleep() { :; };\n' +
    block.replace(/^          /gm, "").replaceAll("/tmp/storage-backup-health-after.json", join(dir, "after.json"));
  try {
    const current = Date.now();
    const stamp = hours => new Date(current - hours * 3_600_000).toISOString();
    for (const [hours, status, expected] of [[2,"healthy",0], [48,"warning",1], [49,"warning",1],
      [-1,"healthy",1], [2,"unknown",1], [37,"warning",1]]) {
      writeFileSync(summary, "");
      const value = { ...payload(hours,status), lastCompletedAt: stamp(hours) };
      const result = spawnSync("bash", ["-e", "-c", command], {
        cwd: new URL("../../", import.meta.url), encoding: "utf8",
        env: { ...process.env, FIXTURE_BODY: JSON.stringify(value), PREVIOUS_COMPLETED: stamp(48),
          GITHUB_STEP_SUMMARY: summary, PRODUCTION_ALIAS: "fixture.example.invalid" }
      });
      assert.equal(result.status, expected, result.stderr);
      const text = readFileSync(summary, "utf8");
      if (expected === 0) assert.match(text, /verified newer, fresh completion/);
      else assert.equal(text, "");
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
