import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../app/builder/page.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("builder.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let initializer;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "publish" && node.initializer) initializer = node.initializer;
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(initializer && ts.isArrowFunction(initializer));
// Exercise the actual handler AST with controlled dependencies, not a rewritten
// publication algorithm. This does not execute/render the full Builder page.
const code = ts.transpileModule(`const publish = ${initializer.getText(ast)};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;

function fixture({ locale = "fr", remoteMode = true, growthFails = false, cacheFails = false,
  writeFails = false, signedIn = true, validationErrors = [], growth = async () => {},
  domainReadFails = false, analyticsFails = false, privateMedia = false, mediaFails = false } = {}) {
  const state = { published: false, saved: false, busy: false, error: "", notice: "", growth: "action-synthetic" };
  const calls = [];
  const config = { slug: "synthetic", contentLibrary: { assets: privateMedia ? [
    { id: "asset-synthetic", kind: "image", publishable: true, url: "private://synthetic", rights: "owned", sourceUrl: "" }
  ] : [] } };
  const setter = key => value => { state[key] = typeof value === "function" ? value(state[key]) : value; };
  const deps = {
    errors: validationErrors, remoteMode, remoteSiteId: "site-synthetic", config, locale,
    tr: (fr, en) => locale === "en" ? en : fr, saveQueue: { current: Promise.resolve() }, growthActionId: state.growth,
    setBusy: setter("busy"), setSyncError: setter("error"), setPublicationNotice: setter("notice"),
    setSaved: setter("saved"), setPublished: setter("published"), setGrowthActionId: setter("growth"),
    setRemoteSiteId: setter("siteId"), setConfig: setter("config"),
    getSupabaseBrowserClient: () => ({ auth: { getSession: async () => ({ data: { session: signedIn ? { access_token: "synthetic" } : null } }) } }),
    async saveMySite(value, publish, id) {
      calls.push(["write", value, publish, id]);
      if (writeFails) throw new Error("private-write-marker");
      return { id, status: "published", publishedAt: "2026-10-20T10:00:00Z" };
    },
    async markGrowthActionPublished(...args) {
      calls.push(["growth", ...args]); await growth();
      if (growthFails) throw new Error("private-growth-marker");
    },
    async refreshVerifiedPublicUrl(id) { calls.push(["domain-read", id]); if (domainReadFails) throw new Error("private-domain-marker"); },
    publishDraft(value) { calls.push(["cache", value]); if (cacheFails) throw new Error("private-cache-marker"); },
    trackProductEvent(...args) { calls.push(["analytics", ...args]); if (analyticsFails) throw new Error("private-analytics-marker"); },
    runPostPublishHealth(...args) { calls.push(["health", ...args]); },
    async fetch(path, options) {
      assert.equal(privateMedia, true); assert.equal(path, "/api/media/promote");
      calls.push(["media", JSON.parse(options.body)]);
      assert.equal(options.headers.Authorization, "Bearer synthetic");
      assert.equal(options.headers["X-AJG-Locale"], locale);
      return { ok: !mediaFails, json: async () => mediaFails
        ? { error: "private-media-marker" } : { url: "https://assets.example.invalid/synthetic.jpg" } };
    }
  };
  const publish = new Function(...Object.keys(deps), code + "\nreturn publish;")(...Object.values(deps));
  return { state, calls, publish, config, count: name => calls.filter(call => call[0] === name).length };
}

for (const locale of ["fr", "en"]) {
  for (const [label, options] of [
    ["Growth tracking fails", { growthFails: true }],
    ["local cache fails", { cacheFails: true }],
    ["both follow-ups fail", { growthFails: true, cacheFails: true }]
  ]) {
    test(`${locale}: confirmed remote publication survives when ${label}`, async () => {
      const f = fixture({ locale, ...options });
      await f.publish();
      assert.equal(f.state.published, true);
      assert.equal(f.state.saved, true);
      assert.equal(f.state.error, "");
      assert.equal(f.state.busy, false);
      assert.equal(f.count("write"), 1);
      assert.deepEqual(f.calls.find(call => call[0] === "write").slice(2), [true, "site-synthetic"]);
      assert.equal(f.count("cache"), 1);
      assert.equal(f.count("growth"), 1);
      assert.equal(f.count("health"), 1);
      assert.equal(f.count("analytics"), 1);
      assert.equal(f.state.growth, options.growthFails ? "action-synthetic" : "");
      assert.match(f.state.notice, locale === "fr" ? /confirmée/ : /confirmed/);
      if (options.growthFails) assert.match(f.state.notice, /Growth/);
      if (options.cacheFails) assert.match(f.state.notice, locale === "fr" ? /navigateur/ : /browser/);
      assert.equal(JSON.stringify(f.state).includes("private-"), false);
    });
  }

  test(`${locale}: only a confirmed publication can set success or run follow-ups`, async () => {
    for (const options of [{ signedIn: false }, { writeFails: true }]) {
      const f = fixture({ locale, ...options }); await f.publish();
      assert.equal(f.state.published, false);
      assert.equal(f.state.saved, false);
      assert.equal(f.state.notice, "");
      assert.equal(f.state.busy, false);
      for (const action of ["growth", "cache", "health", "analytics"]) assert.equal(f.count(action), 0);
      assert.match(f.state.error, locale === "fr" ? /confirmée/ : /confirmed/);
      assert.equal(JSON.stringify(f.state).includes("private-"), false);
    }
  });

  test(`${locale}: local-only cache failure cannot claim remote or local publication success`, async () => {
    const f = fixture({ locale, remoteMode: false, cacheFails: true }); await f.publish();
    assert.equal(f.state.published, false);
    assert.equal(f.state.saved, false);
    assert.equal(f.state.notice, "");
    assert.equal(f.state.busy, false);
    assert.equal(f.count("write"), 0);
    assert.equal(f.count("health"), 0);
    assert.equal(f.count("analytics"), 0);
    assert.match(f.state.error, locale === "fr" ? /confirmée/ : /confirmed/);
    assert.equal(JSON.stringify(f.state).includes("private-"), false);
  });

  test(`${locale}: unexpected post-confirmation checks cannot erase publication evidence`, async () => {
    for (const options of [{ domainReadFails: true }, { analyticsFails: true }]) {
      const f = fixture({ locale, ...options }); await f.publish();
      assert.equal(f.state.published, true);
      assert.equal(f.state.saved, true);
      assert.equal(f.state.error, "");
      assert.equal(f.state.busy, false);
      assert.equal(f.count("write"), 1);
      assert.match(f.state.notice, locale === "fr" ? /confirmée/ : /confirmed/);
      assert.equal(JSON.stringify(f.state).includes("private-"), false);
    }
  });

  test(`${locale}: media preparation failure never claims publication or repeats the action`, async () => {
    const f = fixture({ locale, privateMedia: true, mediaFails: true }); await f.publish();
    assert.equal(f.count("media"), 1);
    assert.equal(f.count("write"), 0);
    assert.equal(f.state.published, false);
    assert.equal(f.state.saved, false);
    assert.equal(f.state.notice, "");
    assert.match(f.state.error, locale === "fr" ? /confirmée/ : /confirmed/);
    assert.equal(JSON.stringify(f.state).includes("private-"), false);
    assert.equal(f.count("health"), 0);
  });
}

test("success is visible before pending Growth bookkeeping settles", async () => {
  let complete;
  const waiting = new Promise(resolve => { complete = resolve; });
  const f = fixture({ growth: () => waiting });
  const publishing = f.publish();
  for (let i = 0; i < 12; i++) await Promise.resolve();
  assert.equal(f.count("write"), 1);
  assert.equal(f.count("growth"), 1);
  const acknowledged = f.state.published;
  complete(); await publishing;
  assert.equal(acknowledged, true);
  assert.equal(f.state.published, true);
});

test("unchanged successful remote and local publication retain their exact contracts", async () => {
  for (const remoteMode of [true, false]) {
    const f = fixture({ remoteMode }); await f.publish();
    assert.equal(f.state.published, true);
    assert.equal(f.state.saved, true);
    assert.equal(f.state.error, "");
    assert.equal(f.state.notice, "");
    assert.equal(f.state.busy, false);
    assert.equal(f.count("write"), remoteMode ? 1 : 0);
    assert.equal(f.count("health"), remoteMode ? 1 : 0);
    assert.equal(f.count("cache"), 1);
    assert.equal(f.count("analytics"), 1);
  }
});

test("validation failures still perform no publication or follow-up", async () => {
  const f = fixture({ validationErrors: [{ message: "required field" }] }); await f.publish();
  assert.deepEqual(f.calls, []);
  assert.equal(f.state.published, false);
  assert.equal(f.state.busy, false);
});

test("confirmed publication keeps promoted media even when both follow-ups fail", async () => {
  const f = fixture({ privateMedia: true, cacheFails: true, growthFails: true }); await f.publish();
  assert.equal(f.count("media"), 1);
  assert.equal(f.count("write"), 1);
  assert.deepEqual(f.calls.find(call => call[0] === "media")[1], {
    siteId: "site-synthetic", privateRef: "private://synthetic", assetId: "asset-synthetic", rights: "owned", sourceUrl: ""
  });
  assert.equal(f.state.config.contentLibrary.assets[0].url, "https://assets.example.invalid/synthetic.jpg");
  assert.equal(f.state.published, true);
  assert.equal(f.state.error, "");
  assert.equal(f.count("health"), 1);
});
