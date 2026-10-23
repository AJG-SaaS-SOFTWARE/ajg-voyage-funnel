import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../app/feedback/page.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText;

const deferred = () => {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
};
const flush = async () => { for (let index = 0; index < 20; index += 1) await Promise.resolve(); };

function fixture({ readSite, readBeta }) {
  const state = [];
  const refs = [];
  const effects = [];
  const timers = [];
  const submissions = [];
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
    "../../lib/product-analytics": {
      submitFeedback: async payload => { submissions.push(payload); },
      trackProductEvent: async () => undefined
    },
    "../../lib/product-i18n": { useProductLocale: () => ({ tr: (_fr, en) => en }) },
    "../../lib/supabase-site-repository": { getMySite: readSite },
    "../../components/LanguageSwitch": { LanguageSwitch: "language-switch" },
    "../../components/BetaExperienceSwitch": { BetaExperienceSwitch: "beta-experience-switch" },
    "../../lib/subscription": { getMyBetaAccess: readBeta },
    "../../lib/beta-experience-mode": {
      readBetaExperienceMode: () => "essential",
      writeBetaExperienceMode: () => undefined
    }
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
  return { effects, state, timers, submissions, render };
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

test("a hung feedback context blocks submission, times out, and can be retried safely", async () => {
  const lateSite = deferred();
  let siteReads = 0;
  const page = fixture({
    readSite: () => {
      siteReads += 1;
      return siteReads === 1 ? lateSite.promise : Promise.resolve({ id: "site-a" });
    },
    readBeta: async () => ({ active: false, startsAt: null, expiresAt: null })
  });
  page.render();
  page.effects[0]();
  await flush();
  assert.equal(page.timers.length, 1);
  assert.equal(page.timers[0].delay, 15_000);

  page.state[2] = "Useful feedback";
  let tree = page.render();
  const form = find(tree, node => node.type === "form");
  await form.props.onSubmit({ preventDefault() {} });
  assert.equal(page.submissions.length, 0, "do not submit without a confirmed context");
  assert.match(page.state[3], /must be confirmed/);

  page.timers[0].callback();
  await flush();
  assert.equal(page.state[8], "error");
  assert.match(page.state[9], /could not be confirmed/);

  lateSite.resolve({ id: "late-site" });
  await flush();
  assert.equal(page.state[8], "error");
  assert.equal(page.state[5], null, "ignore the first read after its deadline");

  tree = page.render();
  const retry = find(tree, node => node.type === "button" && node.props.type === "button");
  assert.ok(retry);
  retry.props.onClick();
  await flush();
  assert.equal(page.state[8], "ready");
  assert.equal(page.state[5], "site-a");

  tree = page.render();
  await find(tree, node => node.type === "form").props.onSubmit({ preventDefault() {} });
  assert.equal(page.submissions.length, 1);
  assert.equal(page.submissions[0].siteId, "site-a");
  assert.match(page.state[3], /linked to the relevant website/);
});

test("feedback without an available website does not claim that it was linked", async () => {
  const page = fixture({
    readSite: async () => null,
    readBeta: async () => ({ active: false, startsAt: null, expiresAt: null })
  });
  page.render();
  page.effects[0]();
  await flush();
  assert.equal(page.state[8], "ready");
  assert.equal(page.state[5], null);

  page.state[2] = "General feedback";
  const tree = page.render();
  await find(tree, node => node.type === "form").props.onSubmit({ preventDefault() {} });
  assert.equal(page.submissions.length, 1);
  assert.equal(page.submissions[0].siteId, null);
  assert.match(page.state[3], /No website was available to link it/);
  assert.doesNotMatch(page.state[3], /linked to the relevant website/);
});
