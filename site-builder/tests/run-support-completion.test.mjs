import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const code = ts.transpileModule(fs.readFileSync(new URL("../lib/run-intake-reporting.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const ticketId = "10000000-0000-4000-8000-000000000001", requestId = "req_1234abcd";
function harness(options = {}) {
  const calls = [], m = { exports: {} };
  const fetch = async (url, init) => {
    calls.push({ url, init });
    if (options.lost || (options.lostPost && init.method === "POST")) throw Error("private-provider-detail");
    if (init.method === "POST") {
      assert.deepEqual(JSON.parse(init.body), { action: "resolve_support", ticketId, requestId });
      if (options.brokenAck) return new Response("{", { headers: { "content-type": "application/json" } });
      return Response.json({ ok: true, ticketId, requestId, status: "resolved", resolutionVerified: true, ...options.receipt }, { status: options.status || 200 });
    }
    return Response.json({ ok: true, receipt: { ticketId, requestId, status: options.unresolved ? "triaged" : "resolved", resolutionVerified: !options.noProof && !options.unresolved, product: "ELTARA", source: "builder-support", updatedAt: "2026-10-18T16:00:00Z",...options.getReceipt } });
  };
  new Function("require", "module", "exports", "fetch", "process", code)(() => { throw Error("unexpected import"); }, m, m.exports, fetch,
    { env: { AJG_RUN_TOKEN: options.noToken ? "" : "synthetic" } });
  return { calls, run: () => m.exports.resolveSupportTicketInRun(ticketId, requestId), read: () => m.exports.readSupportTicketInRun(ticketId,requestId),
    notify: async (rows = [{ metadata: { request_id: requestId } }]) => m.exports.completeVerifiedSupportRepairInRun({ from() {
      return { select() { return this; }, eq() { return this; }, order() { return this; }, async limit() { return { data: rows, error: null }; } };
    } }, ticketId) };
}
test("central completion requires exact positive persistence and an independent resolved readback", async () => {
  const h = harness(); assert.equal(await h.run(), true); assert.equal(h.calls.length, 2);
  assert.equal(h.calls[0].init.redirect, "error"); assert.equal(h.calls[1].init.cache, "no-store");
});
test("a lost completion response is recovered only through a verified read, without a second POST",async()=>{
  for(const options of [{lostPost:true},{brokenAck:true}]){
    const h=harness(options);assert.equal(await h.run(),true);
    assert.equal(h.calls.filter(c=>c.init.method==="POST").length,1);assert.equal(h.calls.length,2);
  }
  for(const options of [{lostPost:true,noProof:true},{lostPost:true,unresolved:true}]){
    assert.equal(await harness(options).run(),false);
  }
});
test("read-only central state preserves pending identity and rejects unrelated or malformed receipts",async()=>{
  const h=harness({unresolved:true});assert.deepEqual(await h.read(),{status:"triaged",resolutionVerified:false});
  assert.equal(h.calls.some(c=>c.init.method==="POST"),false);
  for(const getReceipt of [{ticketId:"other"},{requestId:"other"},{product:"other"},{source:"other"},{status:"unknown"},{updatedAt:"invalid"},{status:"triaged",resolutionVerified:true}]) {
    assert.equal(await harness({getReceipt}).read(),null);
  }
});
test("mismatched, failed or uncertain completion never becomes a successful recipe", async () => {
  for (const options of [{ receipt: { requestId: "other" } }, { receipt: { ticketId: "other" } },
    { receipt: { resolutionVerified: false } }, { receipt: { status: "triaged" } }, { receipt: { ok: false } },
    { status: 503 }, { lost: true }, { unresolved: true }, { noToken: true }, { noProof: true }]) {
    const h = harness(options); assert.equal(await h.run(), false);
    assert.ok(h.calls.filter(call => call.init.method === "POST").length <= 1);
  }
});
test("repair notification uses only a unique persisted receipt and refuses ambiguous or absent provenance", async () => {
  const success = harness(); assert.equal(await success.notify(), true);
  for (const rows of [[], [{ metadata: {} }], [{ metadata: { request_id: "bad" } }],
    [{ metadata: { request_id: requestId } }, { metadata: { request_id: "req_00000000" } }]]) {
    const h = harness(); assert.equal(await h.notify(rows), false); assert.equal(h.calls.length, 0);
  }
});
