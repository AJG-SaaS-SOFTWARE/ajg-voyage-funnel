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

const runner = fs.readFileSync(
  new URL("../lib/release-e2e-runner.ts", import.meta.url),
  "utf8"
);
const fullRoute = fs.readFileSync(
  new URL("../app/api/cron/release-e2e/route.ts", import.meta.url),
  "utf8"
);
const structuralRoute = fs.readFileSync(
  new URL("../app/api/cron/release-e2e-structural/route.ts", import.meta.url),
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
});

test("both release E2E cron routes are secret-protected and use the shared runner", () => {
  for (const route of [fullRoute, structuralRoute]) {
    assert.match(route, /process\.env\.CRON_SECRET/);
    assert.match(route, /authorization ===/);
    assert.match(route, /Bearer/);
    assert.match(route, /runReleaseE2EMirror\(appOrigin/);
  }
  assert.match(fullRoute, /includeAi: true/);
  assert.match(fullRoute, /label: "full"/);
  assert.match(structuralRoute, /includeAi: false/);
  assert.match(structuralRoute, /label: "structural"/);
});

test("shared release E2E runner binds journal evidence to SHA, locale and mode", () => {
  assert.match(runner, /process\.env\.VERCEL_GIT_COMMIT_SHA/);
  assert.match(runner, /\.eq\("deployment_sha", sha\)/);
  assert.match(runner, /\.eq\("locale", locale\)/);
  assert.match(runner, /\.eq\("include_ai", mode\.includeAi\)/);
  assert.match(runner, /include_ai: mode\.includeAi/);
  assert.match(runner, /mode: mode\.label/);
});

test("shared runner uses disposable admin identities and always removes them", () => {
  assert.match(runner, /service\.auth\.admin\.createUser/);
  assert.match(runner, /purpose: "eltara_release_e2e"/);
  assert.match(runner, /role: "admin"/);
  assert.match(runner, /authClient\.auth\.signInWithPassword/);
  assert.match(runner, /finally \{/);
  assert.match(
    runner,
    /\.from\("user_roles"\)[\s\S]*\.delete\(\)[\s\S]*\.eq\("user_id", userId\)/
  );
  assert.match(runner, /service\.auth\.admin\.deleteUser\(userId\)/);
  assert.match(runner, /ban_duration: "876000h"/);
});

test("shared runner reuses the authenticated Builder engine without touching Checkout", () => {
  assert.match(runner, /\["fr", "en"\] as const/);
  assert.match(runner, /plans\.filter\(\(plan\) => plan\.run\)/);
  assert.match(runner, /new URL\("\/api\/admin\/builder-e2e", appOrigin\)/);
  assert.match(runner, /includeAi: mode\.includeAi/);
  assert.match(runner, /locale: plan\.locale/);
  assert.doesNotMatch(runner, /\/api\/billing\/checkout/);
  assert.doesNotMatch(runner, /AJG_BILLING_CHECKOUT_ENABLED/);
  assert.doesNotMatch(runner, /AJG_COMMERCIAL_(?:LEGAL|TAX)_READY/);
});

test("orchestration failures are journaled per mode so retry budgets remain independent", () => {
  assert.match(runner, /failure_stage: "orchestrator"/);
  assert.match(runner, /deployment_sha: sha/);
  assert.match(runner, /include_ai: mode\.includeAi/);
  assert.match(runner, /status: "failed"/);
});

test("Vercel schedules structural evidence before full AI evidence", () => {
  const structural = vercel.crons.find(
    (entry) => entry.path === "/api/cron/release-e2e-structural"
  );
  const full = vercel.crons.find(
    (entry) => entry.path === "/api/cron/release-e2e"
  );
  assert.deepEqual(structural, {
    path: "/api/cron/release-e2e-structural",
    schedule: "25 * * * *"
  });
  assert.deepEqual(full, {
    path: "/api/cron/release-e2e",
    schedule: "35 * * * *"
  });
});
