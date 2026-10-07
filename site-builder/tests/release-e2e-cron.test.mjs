import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const policySource = fs.readFileSync(
  new URL("../lib/release-e2e-policy.ts", import.meta.url),
  "utf8"
);
const policyCode = ts.transpileModule(policySource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;
const policyModule = { exports: {} };
new Function("require", "module", "exports", policyCode)(
  () => ({}),
  policyModule,
  policyModule.exports
);
const { releaseE2ERunDecision } = policyModule.exports;

const route = fs.readFileSync(
  new URL("../app/api/cron/release-e2e/route.ts", import.meta.url),
  "utf8"
);
const vercel = JSON.parse(
  fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8")
);

test("release E2E policy skips a locale already validated for the deployed SHA", () => {
  assert.deepEqual(
    releaseE2ERunDecision(
      [{ status: "success", completed_at: "2026-10-07T12:00:00.000Z" }],
      Date.parse("2026-10-07T13:00:00.000Z")
    ),
    { run: false, reason: "already_validated" }
  );
});

test("release E2E policy enforces cooldown and a hard retry budget", () => {
  const now = Date.parse("2026-10-07T13:00:00.000Z");
  assert.deepEqual(
    releaseE2ERunDecision(
      [{ status: "failed", completed_at: "2026-10-07T12:00:00.000Z" }],
      now
    ),
    { run: false, reason: "cooldown" }
  );

  assert.deepEqual(
    releaseE2ERunDecision(
      [
        { status: "failed", completed_at: "2026-10-06T01:00:00.000Z" },
        { status: "failed", completed_at: "2026-10-06T02:00:00.000Z" },
        { status: "cleanup_failed", completed_at: "2026-10-06T03:00:00.000Z" }
      ],
      now
    ),
    { run: false, reason: "retry_budget_exhausted" }
  );

  assert.deepEqual(
    releaseE2ERunDecision(
      [{ status: "failed", completed_at: "2026-10-06T01:00:00.000Z" }],
      now
    ),
    { run: true, reason: "missing_validation" }
  );
});

test("release E2E cron is secret-protected and SHA-bound", () => {
  assert.match(route, /process\.env\.CRON_SECRET/);
  assert.match(route, /authorization ===/);
  assert.match(route, /Bearer/);
  assert.match(route, /process\.env\.VERCEL_GIT_COMMIT_SHA/);
  assert.match(route, /\.eq\("deployment_sha", sha\)/);
  assert.match(route, /\.eq\("include_ai", true\)/);
});

test("release E2E cron uses a disposable admin identity and always removes it", () => {
  assert.match(route, /service\.auth\.admin\.createUser/);
  assert.match(route, /purpose: "eltara_release_e2e"/);
  assert.match(route, /role: "admin"/);
  assert.match(route, /authClient\.auth\.signInWithPassword/);
  assert.match(route, /finally \{/);
  assert.match(
    route,
    /\.from\("user_roles"\)[\s\S]*\.delete\(\)[\s\S]*\.eq\("user_id", userId\)/
  );
  assert.match(route, /service\.auth\.admin\.deleteUser\(userId\)/);
  assert.match(route, /service\.auth\.admin\.updateUserById\(userId/);
  assert.match(route, /ban_duration: "876000h"/);
});

test("release E2E cron reuses the authenticated Builder engine for missing locales only", () => {
  assert.match(route, /\["fr", "en"\] as const/);
  assert.match(route, /plans\.filter\(\(plan\) => plan\.run\)/);
  assert.match(route, /new URL\("\/api\/admin\/builder-e2e", request\.url\)/);
  assert.match(route, /includeAi: true/);
  assert.match(route, /locale: plan\.locale/);
  assert.doesNotMatch(route, /\/api\/billing\/checkout/);
  assert.doesNotMatch(route, /AJG_BILLING_CHECKOUT_ENABLED/);
  assert.doesNotMatch(route, /AJG_COMMERCIAL_(?:LEGAL|TAX)_READY/);
});

test("Vercel schedules release E2E checks hourly without multiplying successful runs", () => {
  const cron = vercel.crons.find(
    (entry) => entry.path === "/api/cron/release-e2e"
  );
  assert.deepEqual(cron, {
    path: "/api/cron/release-e2e",
    schedule: "35 * * * *"
  });
});
