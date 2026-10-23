import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../app/messages/page.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText;

const deferred = () => {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
};
const flush = async () => { for (let index = 0; index < 20; index += 1) await Promise.resolve(); };

function fixture({ readSites, readMessages }) {
  const state = [];
  const refs = [];
  const effects = [];
  const timers = [];
  const cleared = [];
  let cursor = 0;
  let refCursor = 0;
  let nextTimerId = 0;
  let deleteCalls = 0;
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
      useMemo(factory) { return factory(); },
      useCallback(callback) { return callback; }
    },
    "react/jsx-runtime": { Fragment: "fragment", jsx: element, jsxs: element },
    "../../components/AccountShell": { AccountShell: "account-shell" },
    "../../lib/product-i18n": { useProductLocale: () => ({ locale: "en", tr: (_fr, en) => en }) },
    "../../lib/supabase-site-repository": {
      getMySites: readSites,
      getMyContactMessages: readMessages,
      deleteMyContactMessage: async () => { deleteCalls += 1; }
    }
  };
  const fakeWindow = {
    setTimeout(callback, delay) {
      const id = ++nextTimerId;
      timers.push({ id, callback, delay });
      return id;
    },
    clearTimeout(id) { cleared.push(id); },
    confirm() { throw new Error("unexpected delete confirmation"); }
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
  return { effects, state, refs, timers, cleared, render, deleteCalls: () => deleteCalls };
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

test("a hung inbox snapshot becomes recoverable and ignores late reads", async () => {
  const late = deferred();
  const page = fixture({
    readSites: () => late.promise,
    readMessages: async () => { throw new Error("downstream read should not settle the view"); }
  });
  page.render();
  assert.equal(page.effects.length, 1);
  page.effects[0]();
  await flush();
  assert.equal(page.timers.length, 1);
  assert.equal(page.timers[0].delay, 15_000);

  page.timers[0].callback();
  await flush();
  assert.equal(page.state[3], "error");
  assert.match(page.state[4], /load could not be confirmed/);
  assert.deepEqual(page.state[0], [], "do not expose a partial site list");
  assert.deepEqual(page.state[2], [], "do not expose partial or stale messages");

  late.resolve([{ id: "site-a", slug: "a", config: {} }]);
  await flush();
  assert.equal(page.state[3], "error");
  assert.deepEqual(page.state[0], []);
  assert.deepEqual(page.state[2], []);
  assert.equal(page.deleteCalls(), 0, "a failed read never replays a deletion");
});

test("a superseded site read cannot replace the current inbox", async () => {
  const sites = [
    { id: "site-a", slug: "a", config: {} },
    { id: "site-b", slug: "b", config: {} }
  ];
  const lateB = deferred();
  const currentA = deferred();
  let callsA = 0;
  const page = fixture({
    readSites: async () => sites,
    readMessages: siteId => {
      if (siteId === "site-b") return lateB.promise;
      callsA += 1;
      return callsA === 1 ? Promise.resolve([{ id: "initial-a", senderName: "A", senderEmail: "a@example.invalid", subject: "A", message: "A", createdAt: "2026-01-01T00:00:00Z" }]) : currentA.promise;
    }
  });
  page.render();
  page.effects[0]();
  await flush();
  assert.equal(page.state[3], "ready");

  const tree = page.render();
  const select = find(tree, node => node.type === "select");
  assert.ok(select);
  select.props.onChange({ target: { value: "site-b" } });
  select.props.onChange({ target: { value: "site-a" } });
  assert.deepEqual(page.state[2], [], "clear the previous site's messages while reading");

  currentA.resolve([{ id: "current-a", senderName: "A", senderEmail: "a@example.invalid", subject: "Current", message: "Current", createdAt: "2026-01-02T00:00:00Z" }]);
  await flush();
  assert.equal(page.state[1], "site-a");
  assert.deepEqual(page.state[2].map(item => item.id), ["current-a"]);

  lateB.resolve([{ id: "late-b", senderName: "B", senderEmail: "b@example.invalid", subject: "Late", message: "Late", createdAt: "2026-01-03T00:00:00Z" }]);
  await flush();
  assert.equal(page.state[1], "site-a");
  assert.deepEqual(page.state[2].map(item => item.id), ["current-a"], "ignore the superseded site's late response");
  assert.equal(page.deleteCalls(), 0);
});
