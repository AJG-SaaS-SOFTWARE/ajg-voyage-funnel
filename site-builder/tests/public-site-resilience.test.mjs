import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("public websites retry transient Supabase failures without hiding permanent errors", () => {
  const source = read("lib/public-site.ts");

  assert.match(source, /PUBLIC_READ_RETRY_DELAYS_MS = \[0, 160, 480\]/);
  assert.match(source, /transientPublicReadError/);
  assert.match(source, /fetch failed/);
  assert.match(source, /enotfound/);
  assert.match(source, /web server is down/);
  assert.match(source, /publicReadWithRetry/);
  assert.match(source, /finalAttempt \|\| !transientPublicReadError\(lastError\)/);
});

test("public website outage gets a bilingual retry surface", () => {
  const source = read("app/site/[slug]/error.tsx");

  assert.match(source, /Site momentanément indisponible/);
  assert.match(source, /This website is temporarily unavailable/);
  assert.match(source, /Le site n’a pas été supprimé/);
  assert.match(source, /reset\(\)/);
});
