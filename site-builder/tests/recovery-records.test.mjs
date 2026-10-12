import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

function load(path, dependencies = {}, env = {}) {
  const code = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", "process", code)(name => {
    assert.ok(name in dependencies, name);
    return dependencies[name];
  }, loaded, loaded.exports, { env });
  return loaded.exports;
}
const { readRecoveryRecords } = load("../lib/recovery-records.ts");

test("recovery reads beyond 1000 records and honors a lower server page cap", async () => {
  for (const cap of [1000, 200]) {
    const rows = Array.from({ length: 1251 }, (_, id) => ({ id }));
    const exported = await readRecoveryRecords(async (from, to) => ({ data: rows.slice(from, Math.min(to + 1, from + cap)), error: null }));
    assert.deepEqual(exported, rows);
  }
});

test("empty collections are valid, but errors or missing data never become empty collections", async () => {
  assert.deepEqual(await readRecoveryRecords(async () => ({ data: [], error: null })), []);
  for (const result of [{ data: null, error: null }, { data: [], error: new Error("private marker") }]) {
    await assert.rejects(readRecoveryRecords(async () => result), { message: "recovery_records_unavailable" });
  }
});

test("a failure after the first successful page cannot return a partial recovery collection", async () => {
  let calls = 0;
  await assert.rejects(readRecoveryRecords(async () => ++calls === 1
    ? { data: [{ id: "first" }], error: null }
    : { data: null, error: { message: "private marker" } }), { message: "recovery_records_unavailable" });
});

function route(failure, records = []) {
  const reads = [];
  class NextResponse extends Response { static json(value, options) { return new NextResponse(JSON.stringify(value), options); } }
  const service = {
    storage: { from: () => ({ list: async () => ({ data: [], error: null }) }) },
    from(table) {
      const orders = [];
      return {
        select() { return this; },
        eq(column, value) { assert.equal(column, "site_id"); assert.equal(value, "site-owned"); return this; },
        order(column) { orders.push(column); return this; },
        async range(from, to) {
          reads.push({ table, from, to });
          assert.ok(orders.includes("id"));
          if (table === failure && from >= 1000) return { data: null, error: { message: "private-provider-marker" } };
          return { data: records.slice(from, to + 1), error: null };
        }
      };
    }
  };
  const user = {
    auth: { getUser: async () => ({ data: { user: { id: "owner" } }, error: null }) },
    from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { id: "site-owned", slug: "synthetic" }, error: null }) }),
    rpc: async () => ({ data: { can_export: true }, error: null })
  };
  const loaded = load("../app/api/export/site/route.ts", {
    "next/server": { NextResponse },
    "@supabase/supabase-js": { createClient: (_url, key) => key === "synthetic_service" ? service : user },
    "../../../../lib/recovery-records": { readRecoveryRecords },
    "../../../../lib/recovery-archive": {},
    "../../../../lib/server-locale": { requestProductLocale: request => request.headers.get("x-ajg-locale") === "en" ? "en" : "fr", localize: (locale, fr, en) => locale === "en" ? en : fr }
  }, { NEXT_PUBLIC_SUPABASE_URL: "https://example.test", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic_public", SUPABASE_SECRET_KEY: "synthetic_service" });
  return { ...loaded, reads };
}
const request = (format = "json", locale = "fr") => new Request(`https://example.test/api/export/site?siteId=site-owned&format=${format}`, { headers: { authorization: "Bearer synthetic", "x-ajg-locale": locale } });

test("the real export route returns every page of all three site-scoped collections", async () => {
  const rows = Array.from({ length: 1001 }, (_, id) => ({ id }));
  const api = route(null, rows);
  const response = await api.GET(request());
  assert.equal(response.status, 200);
  const body = await response.json();
  for (const key of ["domains", "travelJournals", "contactMessages"]) assert.deepEqual(body[key], rows);
  assert.equal(api.reads.length, 9);
});

test("both export formats fail safely and privately if any collection fails on a later page", async () => {
  const rows = Array.from({ length: 1001 }, (_, id) => ({ id }));
  for (const table of ["domains", "travel_journals", "contact_messages"]) {
    for (const format of ["json", "archive"]) {
      const response = await route(table, rows).GET(request(format, "en"));
      assert.equal(response.status, 503);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      const body = await response.json();
      assert.match(body.error, /complete export/);
      assert.equal(JSON.stringify(body).includes("private-provider-marker"), false);
      assert.equal(body.format, undefined);
    }
  }
});
