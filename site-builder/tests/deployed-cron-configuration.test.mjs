import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { verifyDeployedCrons } from "../scripts/verify-deployed-crons.mjs";

const manifest = JSON.parse(fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const fixture = () => ({ id: "prj_fixture", accountId: "team_fixture", crons: {
  enabledAt: 100, disabledAt: null, deploymentId: "dpl_fixture",
  definitions: manifest.crons.map(row => ({ ...row, host: "fixture.example.invalid" }))
} });
const verify = (project, expected = manifest) => verifyDeployedCrons(project, expected, "prj_fixture", "team_fixture");

test("live cron verification checks the exact project manifest independent of ordering and prior disable history", () => {
  const p = fixture(); p.crons.definitions.reverse(); p.crons.disabledAt = 50;
  assert.deepEqual(verify(p), { ok: true, projectId: "prj_fixture", schedulerDeploymentId: "dpl_fixture", cronCount: 5, paidAiScheduled: false });
});
const invalid = {
  "foreign project": p => { p.id = "prj_foreign"; },
  "foreign team": p => { p.accountId = "team_foreign"; },
  "disabled scheduler": p => { p.crons.disabledAt = 101; },
  "unobserved scheduler": p => { delete p.crons.enabledAt; },
  "unidentified scheduler origin": p => { p.crons.deploymentId = null; },
  "missing definitions": p => { delete p.crons.definitions; },
  "missing required job": p => { p.crons.definitions.pop(); },
  "changed schedule": p => { p.crons.definitions[0].schedule = "0 0 * * *"; },
  "duplicate job": p => { p.crons.definitions.push(p.crons.definitions[0]); },
  "paid AI job still scheduled": p => { p.crons.definitions.push({ path: "/api/cron/release-e2e", schedule: "35 * * * *" }); },
  "paid AI alias with a query": p => { p.crons.definitions.push({ path: "/api/cron/release-e2e/?x=1", schedule: "35 * * * *" }); }
};
for (const [name, mutate] of Object.entries(invalid)) {
  test(`live cron verification refuses ${name}`, () => {
    const p = fixture(); mutate(p); assert.throws(() => verify(p), /production_cron_configuration_unconfirmed/);
  });
}
test("a paid recipe in the local manifest cannot authorize its automatic invocation", () => {
  const local = { crons: [...manifest.crons, { path: "/api/cron/release-e2e", schedule: "35 * * * *" }] };
  const p = fixture(); p.crons.definitions = local.crons;
  assert.throws(() => verify(p, local), /production_cron_configuration_unconfirmed/);
});
test("the CLI reports unconfirmed metadata without disclosing its contents", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eltara-cron-verification-"));
  try {
    const p = fixture(); p.id = "private-project-marker";
    const projectFile = path.join(dir, "project.json"), manifestFile = path.join(dir, "manifest.json");
    fs.writeFileSync(projectFile, JSON.stringify(p)); fs.writeFileSync(manifestFile, JSON.stringify(manifest));
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/verify-deployed-crons.mjs", import.meta.url)), projectFile, manifestFile, "prj_fixture", "team_fixture"], { encoding: "utf8" });
    assert.equal(result.status, 1); assert.doesNotMatch(result.stdout + result.stderr, /private-project-marker/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test("release cron verification follows promotion, uses a fresh read and cannot invoke or roll back a job", () => {
  const workflow = fs.readFileSync(new URL("../../.github/workflows/site-builder-production.yml", import.meta.url), "utf8");
  const start = workflow.indexOf("- name: Verify deployed cron configuration without invoking jobs");
  assert.ok(start > workflow.indexOf("- name: Verify live production or rollback"));
  const step = workflow.slice(start).split("- name: Run Stripe sandbox mutation smoke")[0];
  assert.match(step, /\/v9\/projects\/\$VERCEL_PROJECT_ID\?teamId=\$VERCEL_ORG_ID/);
  assert.match(step, /node scripts\/verify-deployed-crons\.mjs/);
  assert.match(step, /seq 1 6/);
  assert.doesNotMatch(step, /crons run|\/api\/cron\/release-e2e|--request POST|\/rollback\//);
});
