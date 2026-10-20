import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

// Run the actual TSX repair handler against isolated session/HTTP/state ports.
// No browser, customer account, repair engine, Vercel domain or database is used.
const source = fs.readFileSync(new URL("../app/support/page.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("support.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "repair") handler = node.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(handler);
const code = ts.transpileModule(handler, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const action = "managed_domain_repair";
const health = { siteId: "synthetic-site", diagnosis: { overall: "action", checks: [], repairActions: [action] } };
const receipt = { result: { siteId: health.siteId, action, status: "succeeded", changed: true, verified: true, audited: true }, health };
const response = (status = 200, body = receipt) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

function harness({ locale = "fr", token = async () => "synthetic-token", fetch = async () => response(), load = async () => true, initialHealth = health } = {}) {
  const calls = [], notices = [];
  const payload = { health: structuredClone(initialHealth), tickets: [{ id: "synthetic-ticket", message: "Original synthetic message" }], marker: "preserved" };
  const state = { payload, view: "ready", busy: false, loads: 0, sessions: 0 };
  const repairInFlight = { current: false };
  const ports = { payload, repairInFlight, token: async () => { state.sessions++; return token(); },
    fetch: async (url, options) => { calls.push({ url, ...options }); return fetch(url, options); },
    load: async () => { state.loads++; return load(); }, tr: (fr, en) => locale === "fr" ? fr : en,
    setRepairing: value => { state.busy = value; }, setHealthNotice: value => { notices.push(value); },
    setState: value => { state.view = value; }, setPayload: update => { state.payload = update(state.payload); } };
  const run = new Function(...Object.keys(ports), code + "; return repair;")(...Object.values(ports));
  return { run, calls, notices, state, repairInFlight };
}

for (const locale of ["fr", "en"]) {
  test(`${locale}: a verified audited repair survives a failed list refresh`, async () => {
    const app = harness({ locale, load: async () => { throw Error("synthetic read failure"); } });
    await app.run();
    assert.match(app.notices.at(-1), locale === "fr" ? /Correction technique appliquée/ : /Technical repair applied/);
    assert.match(app.notices.at(-1), locale === "fr" ? /sans relancer cette tentative/ : /without repeating this attempt/);
    assert.doesNotMatch(app.notices.at(-1), /synthetic read failure|Automatic repair failed/);
    assert.equal(app.state.view, "error");
    assert.equal(app.state.loads, 1);
    assert.equal(app.calls.length, 1);
    assert.deepEqual(app.state.payload.health.diagnosis.repairActions, []);
    assert.equal(app.state.busy, false);
    assert.equal(app.repairInFlight.current, false);
  });

  test(`${locale}: unknown, unrelated or unverified receipts cannot claim a repair`, async () => {
    const invalid = [null, {}, { ...receipt, result: null },
      ...[{ siteId: "other" }, { action: "other" }, { status: "unexpected" }, { status: "no_change", changed: true }, { changed: false }, { changed: "true" }, { verified: false }, { verified: "true" }, { audited: false }, { audited: undefined }].map(patch => ({ ...receipt, result: { ...receipt.result, ...patch } })),
      { ...receipt, health: null },
      { ...receipt, health: { ...health, siteId: "other" } },
      { ...receipt, health: { ...health, diagnosis: { overall: "healthy" } } },
      { ...receipt, health: { ...health, diagnosis: { checks: [], overall: "unexpected" } } }];
    for (const body of invalid) {
      const app = harness({ locale, fetch: async () => response(200, body) });
      await app.run();
      assert.match(app.notices.at(-1), locale === "fr" ? /n’a pas pu être confirmée/ : /could not be confirmed/);
      assert.equal(app.state.view, "error");
      assert.equal(app.state.loads, 0);
      assert.equal(app.calls.length, 1);
      assert.equal(app.state.busy, false);
    }
  });

  test(`${locale}: network, 5xx, wrong HTTP status and invalid JSON require a read, never an automatic POST retry`, async () => {
    for (const fetch of [async () => { throw Error("synthetic transport"); }, async () => response(503, { error: "synthetic server uncertainty" }), async () => response(202), async () => ({ ...response(), json: async () => { throw SyntaxError("synthetic JSON"); } })]) {
      const app = harness({ locale, fetch });
      await app.run();
      assert.match(app.notices.at(-1), locale === "fr" ? /Actualisez le diagnostic avant/ : /Refresh the diagnosis before/);
      assert.equal(app.state.view, "error");
      assert.equal(app.state.loads, 0);
      assert.equal(app.calls.length, 1);
      assert.equal(app.repairInFlight.current, false);
    }
  });

  test(`${locale}: no_change and failed are not presented as an applied repair`, async () => {
    for (const status of ["no_change", "failed"]) {
      const app = harness({ locale, fetch: async () => response(200, { ...receipt, result: { ...receipt.result, status, changed: status === "failed" } }) });
      await app.run();
      assert.match(app.notices.at(-1), locale === "fr" ? status === "no_change" ? /Aucune nouvelle correction/ : /ne confirme pas une correction réussie/ : status === "no_change" ? /No new repair was applied/ : /does not confirm a successful repair/);
      assert.doesNotMatch(app.notices.at(-1), /Correction technique appliquée|Technical repair applied/);
      assert.equal(app.state.loads, 1);
      assert.deepEqual(app.state.payload.health.diagnosis.repairActions, []);
    }
  });
}

test("the local guard precedes session lookup and releases after one correlated POST", async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const app = harness({ token: () => pending });
  const first = app.run();
  const again = app.run();
  const busyBeforeSession = app.state.busy;
  release("synthetic-token");
  await Promise.all([first, again]);
  assert.equal(busyBeforeSession, true);
  assert.equal(app.state.sessions, 1);
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0].url, "/api/support/remediate");
  assert.equal(app.calls[0].method, "POST");
  assert.deepEqual(JSON.parse(app.calls[0].body), { siteId: health.siteId, action });
  assert.equal(app.calls[0].headers.Authorization, "Bearer synthetic-token");
});

test("session rejection is caught and permits a later manual attempt", async () => {
  let attempts = 0;
  const app = harness({ token: async () => { if (++attempts === 1) throw Error("synthetic session failure"); return "synthetic-token"; } });
  await app.run();
  assert.equal(app.calls.length, 0);
  assert.equal(app.state.busy, false);
  assert.equal(app.repairInFlight.current, false);
  await app.run();
  assert.equal(app.calls.length, 1);
});

test("absent session or unauthorized response requires sign-in without claiming a repair", async () => {
  for (const input of [{ token: async () => null }, { fetch: async () => response(401, { error: "Sign in required" }) }]) {
    const app = harness(input);
    await app.run();
    assert.equal(app.state.view, "guest");
    assert.equal(app.state.loads, 0);
    assert.equal(app.state.busy, false);
  }
});

test("no offered action means no session or mutation request", async () => {
  const app = harness({ initialHealth: { ...health, diagnosis: { ...health.diagnosis, repairActions: [] } } });
  await app.run();
  assert.equal(app.state.sessions, 0);
  assert.equal(app.calls.length, 0);
});

test("normal success keeps the confirmation and does not merge unrelated returned fields", async () => {
  const app = harness({ fetch: async () => response(200, { ...receipt, health: { ...health, marker: "untrusted replacement" }, tickets: [] }) });
  await app.run();
  assert.match(app.notices.at(-1), /Correction technique appliquée/);
  assert.equal(app.state.view, "ready");
  assert.equal(app.state.payload.marker, "preserved");
  assert.equal(app.state.payload.tickets[0].message, "Original synthetic message");
  assert.equal(app.state.payload.health.marker, undefined);
});

test("a refresh without a result cannot be called a refreshed list", async () => {
  const app = harness({ load: async () => false });
  await app.run();
  assert.match(app.notices.at(-1), /Correction technique appliquée.*liste n’a pas pu être actualisée/);
});
