import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("ELTARA Run callback exposes a privacy-safe health signal", () => {
  const source = readFileSync("app/api/run/support-sync/route.ts", "utf8");
  assert.match(source, /export async function GET/);
  assert.match(source, /tokenConfigured/);
  assert.match(source, /databaseConfigured/);
  assert.match(source, /Synchronisation AJG Run → ELTARA prête/);
  assert.doesNotMatch(source, /return NextResponse\.json\([^)]*AJG_RUN_TOKEN/);
});
