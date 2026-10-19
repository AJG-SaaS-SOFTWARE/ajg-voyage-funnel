import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import crypto from "node:crypto";

const sha = "a".repeat(40);
function compile(file, requireDependency = () => ({})) {
  const code = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(requireDependency, module, module.exports);
  return module.exports;
}
const policy = compile("../lib/release-e2e-policy.ts");
const journal = compile("../lib/builder-e2e-journal.ts");
const runnerCode = ts.transpileModule(fs.readFileSync(new URL("../lib/release-e2e-runner.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

function fixture({ responsePatch = x => x, rowPatch = x => x, queryError = false, queryThrows = false, validated = false, full = false } = {}) {
  const queries = [], requests = [], deletedAdmins = [], failures = []; let createdAdmins = 0;
  const service = {
    auth: { admin: {
      async createUser() { return { data: { user: { id: `temporary-admin-${++createdAdmins}` } }, error: null }; },
      async deleteUser(id) { deletedAdmins.push(id); return { error: null }; },
      async updateUserById() { throw new Error("unexpected ban"); }
    } },
    from(table) {
      if (table === "user_roles") return {
        async insert() { return { error: null }; },
        delete() { return { async eq() { return { error: null }; } }; }
      };
      assert.equal(table, "builder_e2e_runs");
      return {
        async insert(row) { failures.push(row); return { error: null }; },
        select(columns) {
          const filters = {};
          const query = {
            eq(key, value) { filters[key] = value; return query; },
            order() { return query; },
            async limit() { return { data: validated ? [{ status: "success", completed_at: "2026-10-19T12:00:00Z" }] : [], error: null }; },
            async maybeSingle() {
              queries.push({ columns, filters: { ...filters } });
              if (queryThrows) throw new Error("private-journal-marker");
              const locale = filters.locale;
              const row = { id: locale === "fr" ? 17 : 18, deployment_sha: sha, locale, include_ai: full,
                status: "success", completed_at: "2026-10-19T18:00:00Z", steps: [{ key: "cleanup", status: "pass" }] };
              return { data: rowPatch(row), error: queryError ? { message: "private-journal-marker" } : null };
            }
          };
          return query;
        }
      };
    }
  };
  const auth = { auth: { async signInWithPassword() { return { data: { session: { access_token: "synthetic-token" } }, error: null }; } } };
  const dependencies = {
    "server-only": {},
    "@supabase/supabase-js": { createClient: (url, key) => key === "service_synthetic" ? service : auth },
    "./release-e2e-policy": policy,
    "./builder-e2e-journal": journal,
    "./openai-readiness": { auditOpenAiRuntimeCached: async () => ({ status: "ready" }) }
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", "process", "fetch", "crypto", runnerCode)(
    name => { assert.ok(name in dependencies, name); return dependencies[name]; }, module, module.exports,
    { env: { AJG_RELEASE_SHA: sha, NEXT_PUBLIC_SUPABASE_URL: "https://recipe.example.invalid", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publish_synthetic", SUPABASE_SECRET_KEY: "service_synthetic" } },
    async (url, options) => {
      assert.equal(url.href, "https://eltara.example.invalid/api/admin/builder-e2e");
      const request = JSON.parse(options.body); requests.push(request);
      return { ok: true, status: 200, json: async () => responsePatch({ ok: true, deploymentSha: sha,
        locale: request.locale, includeAi: full, customerMode: !full, journalRunId: request.locale === "fr" ? 17 : 18 }) };
    }, crypto
  );
  return { queries, requests, deletedAdmins, failures, run: () => module.exports.runReleaseE2EMirror("https://eltara.example.invalid", { includeAi: full, label: full ? "full" : "structural" }) };
}

test("the actual runner binds each successful child to its exact persisted recipe and cleanup", async () => {
  for (const full of [false, true]) {
    const f = fixture({ full }); const result = await f.run();
    assert.equal(result.status, 200); assert.equal(result.body.ok, true);
    assert.equal(f.queries.length, 2);
    for (const [index, locale] of ["fr", "en"].entries()) {
      assert.deepEqual(f.queries[index].filters, { id: index + 17, deployment_sha: sha, locale, include_ai: full });
    }
    assert.equal(f.requests.length, 2); assert.equal(f.deletedAdmins.length, 2);
    assert.equal(f.failures.length, 0);
  }
});

const invalidResponses = {
  "foreign deployment": x => ({ ...x, deploymentSha: "b".repeat(40) }),
  "wrong locale": x => ({ ...x, locale: "other" }),
  "wrong AI mode": x => ({ ...x, includeAi: !x.includeAi }),
  "wrong customer mode": x => ({ ...x, customerMode: !x.customerMode }),
  "absent journal ID": x => ({ ...x, journalRunId: undefined }),
  "invalid journal ID": x => ({ ...x, journalRunId: 0 })
};
for (const [name, patch] of Object.entries(invalidResponses)) {
  test(`HTTP 200 and ok=true cannot validate a child with ${name}`, async () => {
    const f = fixture({ responsePatch: patch }); const result = await f.run();
    assert.equal(result.status, 503); assert.equal(result.body.ok, false);
    assert.equal(f.queries.length, 0, "reject identity mismatch before journal lookup");
    assert.equal(f.requests.length, 2); assert.equal(f.deletedAdmins.length, 2);
    assert.equal(f.failures.length, 2);
    assert.ok(f.failures.every(row => row.deployment_sha === sha && row.failure_stage === "orchestrator" && row.status === "failed" && row.detail === "release_recipe_evidence_unconfirmed"));
    assert.doesNotMatch(JSON.stringify(result), /private-journal-marker/);
  });
}
const invalidRows = {
  "absent row": () => null,
  "different ID": x => ({ ...x, id: x.id + 10 }),
  "different SHA": x => ({ ...x, deployment_sha: "b".repeat(40) }),
  "different locale": x => ({ ...x, locale: "other" }),
  "different AI mode": x => ({ ...x, include_ai: !x.include_ai }),
  "unfinished status": x => ({ ...x, status: "running" }),
  "invalid completion timestamp": x => ({ ...x, completed_at: "invalid" }),
  "missing completion timestamp": x => ({ ...x, completed_at: null }),
  "missing cleanup": x => ({ ...x, steps: [] }),
  "failed cleanup": x => ({ ...x, steps: [{ key: "cleanup", status: "fail" }] }),
  "conflicting cleanup": x => ({ ...x, steps: [{ key: "cleanup", status: "pass" }, { key: "cleanup", status: "fail" }] })
};
for (const [name, patch] of Object.entries(invalidRows)) {
  test(`successful child cannot override journal evidence with ${name}`, async () => {
    const f = fixture({ rowPatch: patch }); const result = await f.run();
    assert.equal(result.status, 503); assert.equal(result.body.ok, false);
    assert.equal(f.requests.length, 2); assert.equal(f.deletedAdmins.length, 2);
  });
}
for (const options of [{ queryError: true }, { queryThrows: true }]) {
  test(`unavailable journal (${Object.keys(options)[0]}) cannot produce validation or replay`, async () => {
    const f = fixture(options); const result = await f.run();
    assert.equal(result.status, 503); assert.equal(result.body.ok, false);
    assert.equal(f.requests.length, 2); assert.equal(f.deletedAdmins.length, 2);
    assert.doesNotMatch(JSON.stringify(result), /private-journal-marker/);
  });
}
test("already-validated locale decisions remain read-only and create no identities", async () => {
  const f = fixture({ validated: true }); const result = await f.run();
  assert.equal(result.body.ok, true); assert.equal(result.body.executed, false);
  assert.equal(f.requests.length, 0); assert.equal(f.queries.length, 0); assert.equal(f.deletedAdmins.length, 0);
});

test("an uncertain locale is journaled without blocking verification of the independent locale", async () => {
  const f = fixture({ rowPatch: row => row.locale === "fr" ? null : row });
  const result = await f.run();
  assert.equal(result.status, 503);
  assert.deepEqual(result.body.results.map(row => [row.locale, row.ok]), [["fr", false], ["en", true]]);
  assert.equal(f.failures.length, 1); assert.equal(f.failures[0].locale, "fr");
  assert.equal(f.requests.length, 2); assert.equal(f.deletedAdmins.length, 2);
});
