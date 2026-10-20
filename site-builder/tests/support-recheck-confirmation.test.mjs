import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

// Extract and execute the actual page handler with isolated session/HTTP/list
// ports. No real account, backend mutation, browser or repair is involved.
const source = fs.readFileSync(new URL("../app/support/page.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("support.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "recheck") handler = node.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(handler);
const code = ts.transpileModule(handler, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const response = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
const ticket = { id: "synthetic-ticket", status: "waiting_customer", message: "Original synthetic message" };

function harness({ locale = "fr", token = async () => "synthetic-token", fetch = async () => response(200, { ticket: { id: ticket.id, status: "resolved" } }), load = async () => true } = {}) {
  const calls = [], notices = [];
  const state = { busy: null, view: "ready", payload: { tickets: [ticket], marker: "preserved" }, loads: 0 };
  const rechecking = { current: false };
  const ports = { rechecking, token, fetch: async (url, options) => { calls.push({ url, ...options }); return fetch(url, options); },
    load: async () => { state.loads++; return load(); }, tr: (fr, en) => locale === "fr" ? fr : en,
    setRecheckingId: value => { state.busy = value; }, setNotice: value => { notices.push(value); },
    setState: value => { state.view = value; }, setPayload: update => { state.payload = update(state.payload); } };
  const run = new Function(...Object.keys(ports), code + "; return recheck;")(...Object.values(ports));
  return { run: () => run(ticket.id), other: () => run("another-ticket"), calls, notices, state, rechecking };
}

for (const locale of ["fr", "en"]) {
  test(`${locale}: a confirmed result survives a failed list refresh for every supported status`, async () => {
    for (const status of ["resolved", "diagnosed", "waiting_customer"]) {
      const app = harness({ locale, fetch: async () => response(200, { ticket: { id: ticket.id, status, message: "Do not trust arbitrary fields" } }), load: async () => { throw Error("synthetic read failure"); } });
      await app.run();
      assert.match(app.notices.at(-1), locale === "fr" ? /résolue automatiquement|nécessite une vérification|reste nécessaire/ : /resolved automatically|requires review|still required/);
      assert.match(app.notices.at(-1), locale === "fr" ? /résultat ci-dessus est confirmé/ : /result above is confirmed/);
      assert.doesNotMatch(app.notices.at(-1), /Support indisponible|synthetic read failure|Unable to run/);
      assert.equal(app.state.payload.tickets[0].status, status);
      assert.equal(app.state.payload.tickets[0].message, ticket.message);
      assert.equal(app.state.payload.marker, "preserved");
      assert.equal(app.state.view, "error");
      assert.equal(app.calls.length, 1);
      assert.equal(app.state.loads, 1);
      assert.equal(app.state.busy, null);
      assert.equal(app.rechecking.current, false);
    }
  });

  test(`${locale}: missing, unrelated, malformed and unsupported receipts cannot claim success`, async () => {
    for (const [status, body] of [[200, null], [200, {}], [200, { ticket: { id: "other", status: "resolved" } }], [200, { ticket: { id: ticket.id } }], [200, { ticket: { id: ticket.id, status: "unexpected" } }], [202, { ticket: { id: ticket.id, status: "resolved" } }], [503, { error: "synthetic server uncertainty" }]]) {
      const app = harness({ locale, fetch: async () => response(status, body) });
      await app.run();
      assert.match(app.notices.at(-1), locale === "fr" ? /n’a pas été confirmé/ : /could not be confirmed/);
      assert.equal(app.state.payload.tickets[0].status, "waiting_customer");
      assert.equal(app.state.loads, 0);
      assert.equal(app.calls.length, 1);
    }
  });

  test(`${locale}: network uncertainty requires a read and never automatically retries the PATCH`, async () => {
    const app = harness({ locale, fetch: async () => { throw Error("synthetic transport"); } });
    await app.run();
    assert.match(app.notices.at(-1), locale === "fr" ? /n’a pas été reçu.*Actualisez/ : /was not received.*Refresh/);
    assert.equal(app.state.loads, 0);
    assert.equal(app.calls.length, 1);
    assert.equal(app.state.busy, null);
    assert.equal(app.rechecking.current, false);
  });
}

test("a synchronous guard blocks duplicate and cross-ticket rechecks before session awaits", async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const app = harness({ token: () => pending });
  const first = app.run();
  const repeats = [app.run(), app.other()];
  const busyBeforeSession = app.state.busy;
  const callsBeforeSession = app.calls.length;
  release("synthetic-token");
  await Promise.all([first, ...repeats]);
  assert.equal(callsBeforeSession, 0);
  assert.equal(busyBeforeSession, ticket.id);
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0].method, "PATCH");
  assert.equal(app.calls[0].url, "/api/support/tickets");
  assert.deepEqual(JSON.parse(app.calls[0].body), { id: ticket.id });
  assert.equal(app.calls[0].headers.Authorization, "Bearer synthetic-token");
});

test("session failures are contained and release the guard for a manual retry", async () => {
  let attempts = 0;
  const app = harness({ token: async () => { if (++attempts === 1) throw Error("synthetic session failure"); return "synthetic-token"; } });
  await app.run();
  assert.equal(app.calls.length, 0);
  assert.equal(app.state.busy, null);
  assert.equal(app.rechecking.current, false);
  await app.run();
  assert.equal(app.calls.length, 1);
});

test("no session or an unauthorized response shows sign-in without claiming a result", async () => {
  const missing = harness({ token: async () => null });
  await missing.run();
  assert.equal(missing.state.view, "guest");
  assert.equal(missing.calls.length, 0);
  const denied = harness({ fetch: async () => response(401, { error: "Sign in required" }) });
  await denied.run();
  assert.equal(denied.state.view, "guest");
  assert.equal(denied.state.loads, 0);
  assert.equal(denied.state.payload.tickets[0].status, "waiting_customer");
});

test("a correlated success and confirmed refresh retain the normal result", async () => {
  const app = harness();
  await app.run();
  assert.match(app.notices.at(-1), /résolue automatiquement/);
  assert.equal(app.state.view, "ready");
  assert.equal(app.state.loads, 1);
  assert.equal(app.state.busy, null);
});

test("an unreadable JSON response cannot confirm a diagnosis", async () => {
  const app = harness({ fetch: async () => ({ ...response(200, null), json: async () => { throw SyntaxError("synthetic JSON"); } }) });
  await app.run();
  assert.match(app.notices.at(-1), /n’a pas été confirmé/);
  assert.equal(app.state.loads, 0);
  assert.equal(app.state.payload.tickets[0].status, "waiting_customer");
});

test("a refresh returning no result is not presented as a refreshed list", async () => {
  const app = harness({ load: async () => false });
  await app.run();
  assert.match(app.notices.at(-1), /résolue automatiquement.*liste n’a pas pu être actualisée/);
});

test("every recheck button is disabled while any ticket recheck is pending", () => {
  assert.match(source, /disabled=\{recheckingId !== null\}/);
});
