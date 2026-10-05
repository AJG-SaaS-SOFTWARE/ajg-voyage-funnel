import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Builder support reporting sends only non-PII structured metadata", () => {
  const source = readFileSync("lib/run-intake-reporting.ts", "utf8");
  assert.match(source, /AJG_RUN_TOKEN/);
  assert.match(source, /AJG Site Builder/);
  assert.match(source, /builder-support/);
  assert.doesNotMatch(source, /user_id/i);
  assert.doesNotMatch(source, /subject/);
  assert.doesNotMatch(source, /message/);
  assert.doesNotMatch(source, /email/i);
});

test("support ticket persistence happens before Run reporting", () => {
  const route = readFileSync("app/api/support/tickets/route.ts", "utf8");
  assert.ok(route.indexOf('.from("support_tickets")') < route.lastIndexOf("reportSupportTicketToRun({"));
  const reporter = readFileSync("lib/run-intake-reporting.ts", "utf8");
  assert.match(reporter, /AbortSignal\.timeout\(2_500\)/);
});
