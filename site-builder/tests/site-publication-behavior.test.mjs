import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/supabase-site-repository.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const config = { slug: "synthetic-site", language: "both", brandName: "Synthetic", design: {}, legal: {}, architecture: {}, contentLibrary: {} };

function harness({ existing = true, capability = { can_edit: true, can_publish: true }, capabilityError = null, owner = "owner-a", signedIn = true } = {}) {
  let site = existing ? { id: "site-a", owner_id: owner, slug: config.slug, status: "draft", primary_language: "fr", enabled_languages: ["fr", "en"], design_assets: {} } : null;
  const stats = { writes: [], capabilities: [] };
  const client = {
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: "owner-a" } : null }, error: null }) },
    rpc: async (name, args) => { stats.capabilities.push({ name, args }); return { data: [capability], error: capabilityError }; },
    from(table) {
      const filters = {}; let mutation;
      const query = {
        select() { return query; }, eq(key, value) { filters[key] = value; return query; }, order() { return query; }, limit() { return query; },
        insert(value) { mutation = { kind: "insert", value }; return query; },
        update(value) { mutation = { kind: "update", value }; return query; },
        delete() { mutation = { kind: "delete" }; return query; },
        upsert(value) { mutation = { kind: "upsert", value }; return query; },
        async execute() {
          if (mutation) {
            stats.writes.push({ table, ...mutation });
            if (table === "sites") site = { ...site, ...mutation.value, id: site?.id || "new-site", design_assets: {} };
            return { data: table === "sites" ? structuredClone(site) : null, error: null };
          }
          if (table === "sites") return { data: site && Object.entries(filters).every(([key, value]) => site[key] === value) ? structuredClone(site) : null, error: null };
          return { data: null, error: null };
        },
        maybeSingle() { return query.execute(); }, single() { return query.execute(); },
        then(resolve, reject) { return query.execute().then(resolve, reject); }
      };
      return query;
    }
  };
  const identity = value => value || {};
  const deps = {
    "./site-config": { defaultSiteConfig: config, normalizeContentLibrary: identity, normalizeSiteArchitecture: identity },
    "./supabase-browser": { getSupabaseBrowserClient: () => client },
    "./site-design": { normalizeSiteDesign: identity }, "./site-legal": { normalizeSiteLegalConfig: identity },
    "./product-i18n": { getProductLocale: () => "en" }, "./published-domain": { managedHostname: slug => `${slug}.synthetic.invalid` }
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(name => { assert.ok(name in deps); return deps[name]; }, module, module.exports);
  return { stats, save: (publish = true, siteId = "site-a") => module.exports.saveMySite(config, publish, siteId), create: (publish = true) => module.exports.saveMySite(config, publish) };
}

test("missing explicit site cannot silently create or publish a replacement", async () => {
  for (const publish of [false, true]) {
    const app = harness({ existing: false });
    await assert.rejects(app.save(publish), /Website not found/);
    assert.deepEqual(app.stats.writes, []);
    assert.deepEqual(app.stats.capabilities, []);
  }
});

test("foreign explicit site cannot become an unintended new site", async () => {
  const app = harness({ owner: "owner-b" });
  await assert.rejects(app.save(), /Website not found/);
  assert.deepEqual(app.stats.writes, []);
});

test("publication denial or unavailable capability prevents all existing-site writes", async () => {
  for (const options of [{ capability: { can_edit: true, can_publish: false } }, { capability: null }, { capabilityError: new Error("synthetic capability outage") }]) {
    const app = harness(options);
    await assert.rejects(app.save());
    assert.deepEqual(app.stats.writes, []);
  }
});

test("new-site publication creates only a draft before checking publish capability", async () => {
  const app = harness({ existing: false, capability: { can_publish: false } });
  await assert.rejects(app.create());
  assert.equal(app.stats.writes.length, 1);
  assert.equal(app.stats.writes[0].table, "sites");
  assert.equal(app.stats.writes[0].value.status, "draft");
  assert.equal(app.stats.writes[0].value.published_at, null);
  assert.equal(app.stats.capabilities[0].args.p_site_id, "new-site");
});

test("authorized owned publication persists both languages and prepares its managed domain", async () => {
  const app = harness();
  const remote = await app.save();
  assert.equal(remote.status, "published");
  const write = app.stats.writes.find(x => x.table === "sites");
  assert.equal(write.value.owner_id, "owner-a");
  assert.deepEqual(write.value.enabled_languages, ["fr", "en"]);
  assert.ok(write.value.published_at);
  assert.ok(app.stats.writes.some(x => x.table === "domains" && x.value.hostname === "synthetic-site.synthetic.invalid"));
});

test("unsigned client cannot write a site", async () => {
  const app = harness({ signedIn: false });
  await assert.rejects(app.save(), /signed in/);
  assert.deepEqual(app.stats.writes, []);
});
