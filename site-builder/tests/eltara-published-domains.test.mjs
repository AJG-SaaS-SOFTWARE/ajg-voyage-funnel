import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL("../lib/published-domain.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const module = { exports: {} };
new Function("require", "module", "exports", "process", code)(require, module, module.exports, process);

const {
  preferredPublishedRootDomain,
  publishedRootDomains,
  managedHostname,
  managedSlugFromHostname
} = module.exports;

test("ELTARA is the preferred managed root while the Voyage root remains compatible", () => {
  const previousPreferred = process.env.NEXT_PUBLIC_PUBLISHED_ROOT_DOMAIN;
  const previousLegacy = process.env.NEXT_PUBLIC_LEGACY_PUBLISHED_ROOT_DOMAINS;
  process.env.NEXT_PUBLIC_PUBLISHED_ROOT_DOMAIN = "eltara.ajgsolutionsgroup.com";
  process.env.NEXT_PUBLIC_LEGACY_PUBLISHED_ROOT_DOMAINS = "voyage.ajgsolutionsgroup.com";

  try {
    assert.equal(preferredPublishedRootDomain(), "eltara.ajgsolutionsgroup.com");
    assert.deepEqual(
      publishedRootDomains(),
      ["eltara.ajgsolutionsgroup.com", "voyage.ajgsolutionsgroup.com"]
    );
    assert.equal(managedHostname("demo"), "demo.eltara.ajgsolutionsgroup.com");
    assert.equal(
      managedSlugFromHostname("demo.eltara.ajgsolutionsgroup.com"),
      "demo"
    );
    assert.equal(
      managedSlugFromHostname("demo.voyage.ajgsolutionsgroup.com"),
      "demo"
    );
  } finally {
    if (previousPreferred === undefined) delete process.env.NEXT_PUBLIC_PUBLISHED_ROOT_DOMAIN;
    else process.env.NEXT_PUBLIC_PUBLISHED_ROOT_DOMAIN = previousPreferred;
    if (previousLegacy === undefined) delete process.env.NEXT_PUBLIC_LEGACY_PUBLISHED_ROOT_DOMAINS;
    else process.env.NEXT_PUBLIC_LEGACY_PUBLISHED_ROOT_DOMAINS = previousLegacy;
  }
});

test("nested or unrelated hosts are not treated as managed ELTARA sites", () => {
  const previousPreferred = process.env.NEXT_PUBLIC_PUBLISHED_ROOT_DOMAIN;
  process.env.NEXT_PUBLIC_PUBLISHED_ROOT_DOMAIN = "eltara.ajgsolutionsgroup.com";

  try {
    assert.equal(managedSlugFromHostname("foo.bar.eltara.ajgsolutionsgroup.com"), null);
    assert.equal(managedSlugFromHostname("example.com"), null);
  } finally {
    if (previousPreferred === undefined) delete process.env.NEXT_PUBLIC_PUBLISHED_ROOT_DOMAIN;
    else process.env.NEXT_PUBLIC_PUBLISHED_ROOT_DOMAIN = previousPreferred;
  }
});

test("middleware explicitly supports multiple managed roots", () => {
  const middleware = fs.readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
  assert.match(middleware, /managedSlugFromHostname/);
  assert.match(middleware, /publishedRootDomains/);
});
