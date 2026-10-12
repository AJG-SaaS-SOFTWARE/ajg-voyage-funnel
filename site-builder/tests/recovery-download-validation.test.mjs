import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { gzipSync } from "node:zlib";

const loadedLibraries = new Map();
function library(name) {
  if (loadedLibraries.has(name)) return loadedLibraries.get(name);
  const loaded = { exports: {} };
  loadedLibraries.set(name, loaded.exports);
  const code = ts.transpileModule(fs.readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  new Function("require", "module", "exports", code)(dependency => library(dependency.slice(2)), loaded, loaded.exports);
  return loaded.exports;
}
const site = { id: "site-synthetic", slug: "synthetic" };
function recovery() {
  const config = Object.fromEntries(["firstName", "lastName", "brandName", "heroTitle", "heroSubtitle", "aboutText", "bookingLabel", "bookingUrl", "profileImageUrl", "instagramUrl", "facebookUrl"].map(key => [key, ""]));
  return { format: "ajg-builder-export-v2", site: { ...site, config: { ...config, showTravelJournals: false, primaryLanguage: "fr", enabledLanguages: ["fr"], complianceProfile: "independent-v1" } } };
}
function client(response, { locale = "fr", failClick = false } = {}) {
  const downloads = [], revoked = [], requests = [];
  let removed = 0, created = 0;
  const loaded = { exports: {} };
  const dependencies = {
    "./supabase-browser": { getSupabaseBrowserClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: "synthetic" } }, error: null }) } }) },
    "./supabase-site-repository": { getMySite: async id => { assert.equal(id, site.id); return site; } },
    "./product-i18n": { getProductLocale: () => locale },
    "./site-recovery": library("site-recovery")
  };
  const code = ts.transpileModule(fs.readFileSync(new URL("../lib/billing-access.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  new Function("require", "module", "exports", "fetch", "document", "window", "URL", code)(
    name => { assert.ok(name in dependencies); return dependencies[name]; }, loaded, loaded.exports,
    async (url, options) => { requests.push(url); assert.equal(options.headers.Authorization, "Bearer synthetic"); return response; },
    { createElement: () => {
      const anchor = { href: "", download: "", click() { if (failClick) throw new Error("Download blocked"); downloads.push(this.download); }, remove() { removed++; } };
      return anchor;
    }, body: { appendChild() {} } },
    { setTimeout: callback => { callback(); } },
    { createObjectURL: () => { created++; return "blob:synthetic"; }, revokeObjectURL: url => { revoked.push(url); } }
  );
  return { ...loaded.exports, downloads, revoked, requests, removed: () => removed, created: () => created };
}

test("HTML and JSON error pages returned with HTTP 200 never download as archives", async () => {
  for (const response of [
    new Response("<html>Maintenance</html>", { headers: { "content-type": "text/html" } }),
    new Response('{"error":"private marker"}', { headers: { "content-type": "application/json" } }),
    new Response("wrong compressed content", { headers: { "content-type": "application/gzip" } }),
    new Response(new Uint8Array([31, 139, 8]), { headers: { "content-type": "application/gzip" } })
  ]) {
    const api = client(response);
    await assert.rejects(api.downloadMySiteExport(site.id), /archive reçu est invalide ou incomplet/);
    assert.deepEqual(api.downloads, []);
    assert.equal(api.created(), 0);
  }
});

test("real gzip downloads keep the server filename and release temporary browser resources", async () => {
  const api = client(new Response(gzipSync("synthetic archive"), { headers: { "content-type": "application/gzip", "content-disposition": 'attachment; filename="synthetic.tar.gz"' } }));
  await api.downloadMySiteExport(site.id);
  assert.deepEqual(api.downloads, ["synthetic.tar.gz"]);
  assert.deepEqual(api.revoked, ["blob:synthetic"]);
  assert.equal(api.removed(), 1);
});

test("malformed JSON, HTML and another site's recovery data never download as a ready backup", async () => {
  const other = recovery(); other.site.id = "another-site";
  for (const response of [
    new Response("maintenance", { headers: { "content-type": "text/html" } }),
    new Response("not-json", { headers: { "content-type": "application/json" } }),
    Response.json({ error: "private marker" }),
    Response.json(other)
  ]) {
    const api = client(response, { locale: "en" });
    await assert.rejects(api.downloadMySiteRecoveryJson(site.id), { message: "The received recovery file is invalid or incomplete. Please try again later." });
    assert.deepEqual(api.downloads, []);
    assert.equal(api.created(), 0);
  }
});

test("a valid recovery file is validated for the requested site before download", async () => {
  const api = client(Response.json(recovery()));
  await api.downloadMySiteRecoveryJson(site.id);
  assert.deepEqual(api.downloads, ["eltara-recovery-synthetic.json"]);
  assert.match(api.requests[0], /format=recovery$/);
  assert.deepEqual(api.revoked, ["blob:synthetic"]);
});

test("temporary download resources are released even if the browser rejects the click", async () => {
  const api = client(Response.json(recovery()), { failClick: true });
  await assert.rejects(api.downloadMySiteRecoveryJson(site.id), { message: "Download blocked" });
  assert.equal(api.removed(), 1);
  assert.deepEqual(api.revoked, ["blob:synthetic"]);
});
