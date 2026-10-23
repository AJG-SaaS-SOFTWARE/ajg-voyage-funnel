import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText;

const localDraft = {
  config: { brandName: "Local draft", slug: "local-draft" },
  status: "draft",
  updatedAt: "2026-10-23T00:00:00.000Z"
};

const deferred = () => {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
};

const flush = async () => {
  for (let index = 0; index < 30; index += 1) await Promise.resolve();
};

function fixture({ readSession }) {
  const state = [];
  const refs = [];
  const effects = [];
  const timers = [];
  const trackedEvents = [];
  let cursor = 0;
  let refCursor = 0;
  let nextTimerId = 0;
  const element = (type, props) => ({ type, props });
  const remoteSite = {
    id: "site-a",
    config: { brandName: "Remote website", slug: "remote-website" },
    status: "draft",
    updatedAt: "2026-10-23T01:00:00.000Z",
    publishedAt: null
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
      useCallback(callback) { return callback; }
    },
    "react/jsx-runtime": { Fragment: "fragment", jsx: element, jsxs: element },
    "next/link": { default: "link" },
    "../lib/site-store": { loadDraft: () => localDraft, resetDraft: () => undefined },
    "../lib/supabase-browser": { isSupabaseConfigured: () => true },
    "../lib/supabase-site-repository": { getCurrentUser: readSession, getMySite: async () => remoteSite },
    "../lib/product-i18n": { useProductLocale: () => ({ locale: "en", tr: (_fr, en) => en }) },
    "../lib/product-plan-label": { productPlanLabel: key => key },
    "../components/LanguageSwitch": { LanguageSwitch: "language-switch" },
    "../components/EltaraBrand": { EltaraMark: "eltara-mark" },
    "../components/BetaExperienceSwitch": { BetaExperienceSwitch: "beta-experience-switch" },
    "../lib/onboarding": {
      deriveOnboardingCreationPath: () => null,
      deriveOnboardingProgress: () => null
    },
    "../lib/subscription": {
      getMyBetaAccess: async () => ({ active: false, startsAt: null, expiresAt: null }),
      getMyEntitlements: async () => ({ planKey: "free", status: "inactive" }),
      getMySiteAiAccess: async () => ({ canCreateSite: false }),
      getMySiteEntitlements: async () => ({ planKey: "essential", status: "active" })
    },
    "../lib/product-analytics": {
      getMyBetaJourneyProgress: async () => ({}),
      trackProductEvent: async (...args) => { trackedEvents.push(args); }
    },
    "../lib/beta-experience-mode": {
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

  return { effects, render, state, timers, trackedEvents };
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

test("a hung home context expires, preserves the local draft, and retries without accepting a late result", async () => {
  const firstSession = deferred();
  let sessionReads = 0;
  const page = fixture({
    readSession: () => {
      sessionReads += 1;
      return sessionReads === 1
        ? firstSession.promise
        : Promise.resolve({ email: "client@example.invalid" });
    }
  });

  page.render();
  page.effects[0]();
  await flush();
  assert.equal(page.state[1], "checking");
  assert.equal(page.timers[0].delay, 15_000);

  page.timers[0].callback();
  await flush();
  assert.equal(page.state[1], "error");
  assert.equal(page.state[0].config.brandName, "Local draft");

  const retry = find(page.render(), node => node.type === "button" && textContent(node).includes("Try again"));
  assert.ok(retry);
  retry.props.onClick();
  await flush();
  assert.equal(page.state[1], "authenticated");
  assert.equal(page.state[2], "client@example.invalid");
  assert.equal(page.state[3], "essential");
  assert.equal(page.state[4], true);
  assert.equal(page.state[6], "site-a");
  assert.equal(page.state[0].config.brandName, "Remote website");
  assert.equal(page.trackedEvents.length, 0, "retry must remain read-only");

  firstSession.resolve(null);
  await flush();
  assert.equal(page.state[1], "authenticated", "the expired read cannot overwrite the successful retry");
  assert.equal(page.state[0].config.brandName, "Remote website");
});

test("a backend failure is not presented as an unauthenticated session", async () => {
  const unavailable = fixture({ readSession: async () => { throw new Error("network unavailable"); } });
  unavailable.render();
  unavailable.effects[0]();
  await flush();
  assert.equal(unavailable.state[1], "error");
  assert.notEqual(unavailable.state[1], "guest");

  const signedOut = fixture({ readSession: async () => null });
  signedOut.render();
  signedOut.effects[0]();
  await flush();
  assert.equal(signedOut.state[1], "guest");
});
