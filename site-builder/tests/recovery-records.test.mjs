import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import * as stream from "node:stream";
import * as zlib from "node:zlib";

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
const design = load("../lib/site-design.ts");
const legal = load("../lib/site-legal.ts");
const config = load("../lib/site-config.ts", { "./site-design": design, "./site-legal": legal });
const { siteConfigFromRecoveryExport } = load("../lib/site-recovery.ts", {
  "./site-config": config, "./site-design": design, "./site-legal": legal
});

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

function route(failure, records = [], draftRead = { data: null, error: null }) {
  const reads = [];
  let mediaReads = 0;
  class NextResponse extends Response { static json(value, options) { return new NextResponse(JSON.stringify(value), options); } }
  const service = {
    storage: { from: () => ({ list: async () => { mediaReads++; return { data: [], error: null }; } }) },
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
    from: table => {
      const filters = {};
      return {
        select() { return this; },
        eq(column, value) { filters[column] = value; return this; },
        async maybeSingle() {
          assert.equal(filters.owner_id, "owner");
          if (table === "site_drafts") {
            assert.equal(filters.site_id, "site-owned");
            return draftRead;
          }
          return { data: {
            id: "site-owned", slug: "synthetic", hero_title: "Published title",
            first_name: "Synthetic", last_name: "Owner", brand_name: "Studio", hero_subtitle: "",
            about_text: "", booking_label: "Book", booking_url: "", profile_image_url: "",
            instagram_url: "", facebook_url: "", show_travel_journals: false,
            primary_language: "fr", enabled_languages: ["fr"], compliance_profile: "independent-v1"
          }, error: null };
        }
      };
    },
    rpc: async () => ({ data: { can_export: true }, error: null })
  };
  const loaded = load("../app/api/export/site/route.ts", {
    "next/server": { NextResponse },
    "@supabase/supabase-js": { createClient: (_url, key) => key === "synthetic_service" ? service : user },
    "../../../../lib/recovery-records": { readRecoveryRecords },
    "../../../../lib/recovery-snapshot": load("../lib/recovery-snapshot.ts"),
    "../../../../lib/recovery-archive": load("../lib/recovery-archive.ts", { "node:stream": stream, "node:zlib": zlib }),
    "../../../../lib/server-locale": { requestProductLocale: request => request.headers.get("x-ajg-locale") === "en" ? "en" : "fr", localize: (locale, fr, en) => locale === "en" ? en : fr }
  }, { NEXT_PUBLIC_SUPABASE_URL: "https://example.test", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic_public", SUPABASE_SECRET_KEY: "synthetic_service" });
  return { ...loaded, reads, mediaReads: () => mediaReads };
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

test("JSON and actual TAR.GZ exports preserve published content and the owner's saved draft separately", async () => {
  const draft = { heroTitle: "Unpublished title", language: "en", affiliation: "independent" };
  for (const format of ["json", "archive"]) {
    const response = await route(null, [], { data: { config: draft, updated_at: "2026-10-12T12:00:00Z" }, error: null }).GET(request(format));
    assert.equal(response.status, 200);
    let body;
    if (format === "json") body = await response.json();
    else {
      const tar = zlib.gunzipSync(Buffer.from(await response.arrayBuffer()));
      const size = parseInt(tar.subarray(124, 136).toString().replace(/\0/g, "").trim(), 8);
      body = JSON.parse(tar.subarray(512, 512 + size).toString());
    }
    assert.equal(body.site.config.heroTitle, "Published title");
    assert.deepEqual(body.site.draftConfig, draft);
    assert.equal(body.site.draftUpdatedAt, "2026-10-12T12:00:00Z");
    const restored = siteConfigFromRecoveryExport(body, { id: "site-owned", slug: "current-slug" });
    assert.equal(restored.source, "draft");
    assert.equal(restored.config.heroTitle, "Unpublished title");
    assert.equal(restored.config.language, "en");
    assert.equal(restored.config.brandName, "Studio");
    assert.equal(restored.config.slug, "current-slug");
  }
});

test("a draft read failure or malformed stored draft blocks both exports with a generic error", async () => {
  for (const draftRead of [{ data: null, error: { message: "private marker" } }, { data: { config: null }, error: null }, { data: { config: [] }, error: null }]) {
    for (const format of ["json", "archive"]) {
      const response = await route(null, [], draftRead).GET(request(format));
      assert.equal(response.status, 503);
      assert.equal(JSON.stringify(await response.json()).includes("private marker"), false);
    }
  }
});

test("compact recovery skips unrelated collections and still restores the saved draft", async () => {
  const api = route("contact_messages", [{ id: "unrelated" }], {
    data: { config: { heroTitle: "Latest draft", language: "en" }, updated_at: "2026-10-12T12:00:00Z" }, error: null
  });
  const response = await api.GET(request("recovery"));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.scope, "configuration");
  assert.equal(body.domains, undefined);
  assert.equal(body.travelJournals, undefined);
  assert.equal(body.contactMessages, undefined);
  assert.equal(body.media, undefined);
  assert.deepEqual(api.reads, []);
  assert.equal(api.mediaReads(), 0);
  const restored = siteConfigFromRecoveryExport(body, { id: "site-owned", slug: "synthetic" });
  assert.equal(restored.config.heroTitle, "Latest draft");
  assert.equal(restored.source, "draft");
});

test("compact recovery still fails safely if the saved draft cannot be read", async () => {
  const response = await route(null, [], { data: null, error: { message: "private marker" } }).GET(request("recovery"));
  assert.equal(response.status, 503);
  assert.equal(JSON.stringify(await response.json()).includes("private marker"), false);
});
