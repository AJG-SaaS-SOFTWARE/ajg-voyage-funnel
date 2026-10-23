import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../app/preview/page.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText;

const localConfig = { brandName: "Local draft", slug: "local-draft" };
const remoteConfig = { brandName: "Remote draft", slug: "remote-draft" };

const deferred = () => {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
};

const flush = async () => {
  for (let index = 0; index < 30; index += 1) await Promise.resolve();
};

function fixture({ readRemote, configured = true }) {
  const state = [];
  const refs = [];
  const effects = [];
  const timers = [];
  let cursor = 0;
  let refCursor = 0;
  let nextTimerId = 0;
  const element = (type, props) => ({ type, props });
  const dependencies = {
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in state)) state[index] = initial;
        return [state[index], value => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
      },
      useRef(initial) {
        const index = refCursor++;
        if (!(index in refs)) refs[index] = { current: initial };
        return refs[index];
      },
      useEffect(effect) { effects.push(effect); },
      useCallback(callback) { return callback; }
    },
    "react/jsx-runtime": { Fragment: "fragment", jsx: element, jsxs: element },
    "next/link": { default: "link" },
    "../../components/SitePreview": { default: "site-preview" },
    "../../lib/site-config": { defaultSiteConfig: { brandName: "Default", slug: "" } },
    "../../lib/site-store": { loadDraft: () => ({ config: localConfig }) },
    "../../lib/supabase-browser": { isSupabaseConfigured: () => configured },
    "../../lib/supabase-site-repository": { getMySite: readRemote },
    "../../lib/product-i18n": { useProductLocale: () => ({ tr: (_fr, en) => en }) },
    "../../components/LanguageSwitch": { LanguageSwitch: "language-switch" },
    "../../lib/published-domain": { preferredPublishedRootDomain: () => "eltara.example" }
  };
  const fakeWindow = {
    setTimeout(callback, delay) {
      const id = ++nextTimerId;
      timers.push({ id, callback, delay });
      return id;
    },
    clearTimeout() {}
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", "window", code)(name => {
    assert.ok(name in dependencies, name);
    return dependencies[name];
  }, module, module.exports, fakeWindow);

  function render() {
    cursor = 0;
    refCursor = 0;
    effects.length = 0;
    return module.exports.default();
  }

  return { effects, render, state, timers };
}

function find(node, predicate) {
  if (!node || typeof node !== "object") return null;
  if (predicate(node)) return node;
  const children = node.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = find(child, predicate);
    if (found) return found;
  }
  return null;
}

function textContent(node) {
  if (typeof node === "string") return node;
  if (!node || typeof node !== "object") return "";
  const children = node.props?.children;
  return (Array.isArray(children) ? children : [children]).map(textContent).join("");
}

test("preview shows the local draft immediately, expires a hung remote read, and retries safely", async () => {
  const firstRead = deferred();
  let reads = 0;
  const page = fixture({
    readRemote: () => {
      reads += 1;
      return reads === 1
        ? firstRead.promise
        : Promise.resolve({ config: remoteConfig });
    }
  });

  page.render();
  page.effects[0]();
  await flush();
  assert.equal(page.state[0].brandName, "Local draft");
  assert.equal(page.state[1], "checking");
  assert.equal(page.timers[0].delay, 15_000);

  page.timers[0].callback();
  await flush();
  assert.equal(page.state[0].brandName, "Local draft");
  assert.equal(page.state[1], "error");

  const retry = find(page.render(), node => node.type === "button" && textContent(node).includes("Try again"));
  assert.ok(retry);
  retry.props.onClick();
  await flush();
  assert.equal(page.state[0].brandName, "Remote draft");
  assert.equal(page.state[1], "remote");

  firstRead.resolve({ config: { brandName: "Late draft", slug: "late-draft" } });
  await flush();
  assert.equal(page.state[0].brandName, "Remote draft", "the expired read cannot overwrite the successful retry");
});

test("preview distinguishes remote failure, missing remote data, and local-only mode", async () => {
  const unavailable = fixture({ readRemote: async () => { throw new Error("network unavailable"); } });
  unavailable.render();
  unavailable.effects[0]();
  await flush();
  assert.equal(unavailable.state[0].brandName, "Local draft");
  assert.equal(unavailable.state[1], "error");

  const noRemote = fixture({ readRemote: async () => null });
  noRemote.render();
  noRemote.effects[0]();
  await flush();
  assert.equal(noRemote.state[0].brandName, "Local draft");
  assert.equal(noRemote.state[1], "local");

  const localOnly = fixture({ configured: false, readRemote: async () => { throw new Error("must not run"); } });
  localOnly.render();
  localOnly.effects[0]();
  await flush();
  assert.equal(localOnly.state[0].brandName, "Local draft");
  assert.equal(localOnly.state[1], "local");
  assert.equal(localOnly.timers.length, 0);
});
