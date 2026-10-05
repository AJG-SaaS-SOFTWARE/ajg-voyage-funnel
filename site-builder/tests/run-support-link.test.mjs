import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Builder support Run reporting preserves the ticket reference", () => {
  const route = readFileSync("app/api/support/tickets/route.ts", "utf8");
  const reporter = readFileSync("lib/run-intake-reporting.ts", "utf8");
  assert.match(route, /ticketId: String\(ticket\.id\)/);
  assert.match(reporter, /ticketId: string/);
  assert.match(reporter, /builder-ticket:/);
  assert.match(reporter, /externalRef:/);
});


test("Builder exposes a token-protected Run status callback", () => {
  const source = readFileSync("app/api/run/support-sync/route.ts", "utf8");
  assert.match(source, /AJG_RUN_TOKEN/);
  assert.match(source, /builder-ticket:/);
  assert.match(source, /run_work_item_closed/);
  assert.match(source, /actor: "system"/);
  assert.doesNotMatch(source, /subject|message/);
});
