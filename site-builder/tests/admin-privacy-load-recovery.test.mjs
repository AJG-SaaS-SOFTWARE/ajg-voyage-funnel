import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../app/admin/privacy/page.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText;

const deferred = () => {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
};
const flush = async () => { for (let index = 0; index < 20; index += 1) await Promise.resolve(); };

function fixture({ isAdmin, readRequests = async () => [] }) {
  const state = [];
  const refs = [];
  const effects = [];
  const timers = [];
  const cleared = [];
  let cursor = 0;
  let refCursor = 0;
  let nextTimerId = 0;
  let requestReads = 0;
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
      useEffect(effect) { effects.push(effect); }
    },
    "react/jsx-runtime": { Fragment: "fragment", jsx: element, jsxs: element },
    "../../../components/AdminShell": { AdminShell: "admin-shell" },
    "../../../lib/admin": { isCurrentUserAdmin: isAdmin },
    "../../../lib/supabase-browser": {
      getSupabaseBrowserClient: () => ({
        auth: { getSession: async () => ({ data: { session: { access_token: "fixture-token" } }, error: null }) }
      })
    }
  };
  const fakeWindow = {
    setTimeout(callback, delay) {
      const id = ++nextTimerId;
      timers.push({ id, callback, delay });
      return id;
    },
    clearTimeout(id) { cleared.push(id); },
    prompt() { throw new Error("unexpected mutation prompt"); }
  };
  const fakeFetch = async (_url, options) => {
    requestReads += 1;
    if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const requests = await readRequests();
    return { ok: true, json: async () => ({ requests }) };
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", "window", "fetch", "AbortController", code)(name => {
    assert.ok(name in dependencies, name);
    return dependencies[name];
  }, module, module.exports, fakeWindow, fakeFetch, AbortController);
  function render() {
    cursor = 0;
    refCursor = 0;
    effects.length = 0;
    return module.exports.default();
  }
  return { effects, state, refs, timers, cleared, render, requestReads: () => requestReads };
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

test("a stalled privacy registry read becomes recoverable without being reported as denied", async () => {
  const lateAdminCheck = deferred();
  const page = fixture({ isAdmin: () => lateAdminCheck.promise });
  page.render();
  assert.equal(page.effects.length, 1);
  page.effects[0]();
  await flush();
  assert.equal(page.timers.length, 1);
  assert.equal(page.timers[0].delay, 15_000);

  page.timers[0].callback();
  await flush();
  assert.equal(page.state[1], "error");
  assert.match(page.state[2], /n’a pas pu être lu de façon fiable/);
  assert.deepEqual(page.state[0], []);

  lateAdminCheck.resolve(true);
  await flush();
  assert.equal(page.state[1], "error", "a late authorization check cannot replace the failed view");
  assert.deepEqual(page.state[0], []);
  assert.equal(page.requestReads(), 1, "the late read is aborted before registry data is accepted");
  assert.deepEqual(page.cleared, [page.timers[0].id]);
});

test("a confirmed non-admin remains an access denial and does not read the registry", async () => {
  const page = fixture({ isAdmin: async () => false });
  page.render();
  page.effects[0]();
  await flush();
  assert.equal(page.state[1], "denied");
  assert.equal(page.state[2], "");
  assert.equal(page.requestReads(), 0);
});

test("an explicit retry can recover the complete registry snapshot", async () => {
  const stalled = deferred();
  let checks = 0;
  const requests = [{ id: "privacy-a", scope: "site", status: "requested" }];
  const page = fixture({
    isAdmin: () => ++checks === 1 ? stalled.promise : Promise.resolve(true),
    readRequests: async () => requests
  });
  page.render();
  page.effects[0]();
  await flush();
  page.timers[0].callback();
  await flush();

  const tree = page.render();
  const retry = find(tree, node => node.type === "button" && node.props?.children === "Réessayer");
  assert.ok(retry);
  retry.props.onClick();
  await flush();
  assert.equal(page.state[1], "ready");
  assert.deepEqual(page.state[0], requests);
  assert.equal(page.state[2], "");

  stalled.resolve(true);
  await flush();
  assert.equal(page.state[1], "ready");
  assert.deepEqual(page.state[0], requests, "the superseded read cannot replace the recovered snapshot");
});
