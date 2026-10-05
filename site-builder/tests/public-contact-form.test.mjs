import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("app/api/public/contact/route.ts", "utf8");
const form = readFileSync("components/PublicContactForm.tsx", "utf8");
const modules = readFileSync("components/SiteModulesView.tsx", "utf8");
const published = readFileSync("components/PublishedSite.tsx", "utf8");
const legal = readFileSync("components/SiteLegalPages.tsx", "utf8");
const middleware = readFileSync("middleware.ts", "utf8");

test("public contact endpoint uses the hardened anonymous RPC and a pseudonymous abuse fingerprint", () => {
  assert.match(route, /submit_contact_message/);
  assert.match(route, /createHash\("sha256"\)/);
  assert.match(route, /x-forwarded-for/);
  assert.match(route, /rate_limited/);
  assert.match(route, /contact_disabled/);
  assert.match(route, /content-length/);
});

test("public contact form requires explicit consent and keeps direct email as fallback", () => {
  assert.match(form, /name="consent"/);
  assert.match(form, /type="checkbox"/);
  assert.match(form, /required/);
  assert.match(form, /mailto:/);
  assert.match(form, /api\/public\/contact/);
  assert.match(form, /public-contact-honeypot/);
});

test("published sites receive the immutable site id while previews keep the legacy mailto fallback", () => {
  assert.match(published, /siteId: string/);
  assert.match(published, /siteId=\{siteId\}/);
  assert.match(modules, /siteId \?/);
  assert.match(modules, /<PublicContactForm/);
  assert.match(modules, /mailto:/);
});

test("contact API remains reachable on custom domains because middleware excludes api routes", () => {
  assert.match(middleware, /\(\?!api\|_next\/static/);
});

test("privacy copy changes when the native contact module is enabled", () => {
  assert.match(legal, /hasNativeContact/);
  assert.match(legal, /empreinte technique pseudonymisée/);
  assert.match(legal, /pseudonymous technical fingerprint/);
});
