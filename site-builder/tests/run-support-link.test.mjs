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
