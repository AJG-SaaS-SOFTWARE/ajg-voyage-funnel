import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const shell = readFileSync("components/AccountShell.tsx", "utf8");
const page = readFileSync("app/messages/page.tsx", "utf8");
const repository = readFileSync("lib/supabase-site-repository.ts", "utf8");

test("customer account exposes a contact inbox", () => {
  assert.match(shell, /href:\s*"\/messages"/);
  assert.match(shell, /section: "messages"/);
  assert.match(page, /Messages reçus/);
  assert.match(page, /Received messages/);
});

test("contact inbox stays site-scoped and owner-scoped", () => {
  assert.match(repository, /getMyContactMessages/);
  assert.match(repository, /\.eq\("owner_id", user\.id\)/);
  assert.match(repository, /\.eq\("site_id", siteId\)/);
  assert.match(repository, /deleteMyContactMessage/);
});

test("contact inbox supports direct reply and deletion", () => {
  assert.match(page, /mailto:/);
  assert.match(page, /deleteMyContactMessage/);
  assert.match(page, /window\.confirm/);
});
