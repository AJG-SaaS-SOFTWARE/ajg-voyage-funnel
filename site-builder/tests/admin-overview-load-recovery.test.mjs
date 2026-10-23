import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText;

const deferred = () => {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
};
const flush = async () => { for (let index = 0; index < 30; index += 1) await Promise.resolve(); };

function fixture({ adminChecks, firstSites }) {
  const state = [];
  const refs = [];
  const effects = [];
  const timers = [];
  const cleared = [];
  const reads = { sites: 0, supplementary: 0 };
  let cursor = 0;
  let refCursor = 0;
  let nextTimerId = 0;
  let adminCheck = 0;
  const element = (type, props) => ({ type, props });
  const empty = async () => null;
  const admin = {
    isCurrentUserAdmin: async () => adminChecks[adminCheck++] ?? false,
    getAdminSites: () => {
      reads.sites += 1;
      return reads.sites === 1 && firstSites ? firstSites.promise : Promise.resolve([]);
    },
    getAdminMetrics: async () => ({}),
    getAdminFeedback: async () => [],
    getReleaseReadiness: async () => { reads.supplementary += 1; return null; },
    getAdminBetaMetrics: empty,
    getAdminBetaCohort: empty,
    getAdminBetaOperationsStatus: empty,
    getAdminManagedDomains: async () => [],
    getAdminStorageBackupStatus: empty,
    getAdminVisualReview: empty
  };
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
      useMemo(factory) { return factory(); }
    },
    "react/jsx-runtime": { Fragment: "fragment", jsx: element, jsxs: element },
    "next/link": { __esModule: true, default: "link" },
    "../../components/AdminShell": { AdminShell: "admin-shell" },
    "../../lib/admin": new Proxy(admin, { get: (target, property) => target[property] ?? empty })
  };
  const fakeWindow = {
    setTimeout(callback, delay) {
      const id = ++nextTimerId;
      timers.push({ id, callback, delay });
      return id;
    },
    clearTimeout(id) { cleared.push(id); }
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
  return { cleared, effects, reads, render, timers };
}

function find(node, predicate) {
  if (!node || typeof node !== "object") return null;
  if (predicate(node)) return node;
  for (const value of Object.values(node.props || {})) {
    for (const child of Array.isArray(value) ? value : [value]) {
      const found = find(child, predicate);
      if (found) return found;
    }
  }
  return null;
}

function hasText(tree, expected) {
  return Boolean(find(tree, node => Object.values(node.props || {}).some(value => value === expected)));
}

test("a stalled admin overview becomes recoverable without being reported as denied", async () => {
  const firstSites = deferred();
  const page = fixture({ adminChecks: [true, false], firstSites });
  page.render();
  const cleanup = page.effects[0]();
  await flush();

  assert.equal(page.reads.sites, 1);
  assert.equal(page.timers[0].delay, 15_000);
  page.timers[0].callback();
  await flush();

  let tree = page.render();
  assert.equal(hasText(tree, "Vue d’administration indisponible"), true);
  assert.equal(hasText(tree, "Accès restreint"), false);
  const retry = find(tree, node => node.type === "button" && node.props?.children === "Réessayer la lecture");
  assert.ok(retry);

  retry.props.onClick();
  await flush();
  tree = page.render();
  assert.equal(hasText(tree, "Accès restreint"), true, "only an explicit authorization result may show the denied view");

  firstSites.resolve([]);
  await flush();
  tree = page.render();
  assert.equal(hasText(tree, "Accès restreint"), true, "the stale first read cannot overwrite the retry result");
  assert.equal(page.reads.supplementary, 0, "a superseded core snapshot must not start supplementary reads");
  cleanup();
});

test("an explicit non-admin result bypasses operational reads", async () => {
  const page = fixture({ adminChecks: [false] });
  page.render();
  const cleanup = page.effects[0]();
  await flush();

  const tree = page.render();
  assert.equal(hasText(tree, "Accès restreint"), true);
  assert.equal(hasText(tree, "Vue d’administration indisponible"), false);
  assert.equal(page.reads.sites, 0);
  assert.deepEqual(page.cleared, [page.timers[0].id]);
  cleanup();
});
