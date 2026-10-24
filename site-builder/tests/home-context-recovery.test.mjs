import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import * as supabaseSdk from "@supabase/supabase-js";

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

function fixture({ readSession, locale = "en" }) {
  const downstreamReads = [];
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
    "@supabase/supabase-js": supabaseSdk,
    "../lib/site-store": { loadDraft: () => localDraft, resetDraft: () => undefined },
    "../lib/supabase-browser": { isSupabaseConfigured: () => true },
    "../lib/supabase-site-repository": { getCurrentUser: readSession, getMySite: async () => { downstreamReads.push("site"); return remoteSite; } },
    "../lib/product-i18n": { useProductLocale: () => ({ locale, tr: (fr, en) => locale === "en" ? en : fr }) },
    "../lib/product-plan-label": { productPlanLabel: key => key },
    "../components/LanguageSwitch": { LanguageSwitch: "language-switch" },
    "../components/EltaraBrand": { EltaraMark: "eltara-mark" },
    "../components/BetaExperienceSwitch": { BetaExperienceSwitch: "beta-experience-switch" },
    "../lib/onboarding": {
      deriveOnboardingCreationPath: () => null,
      deriveOnboardingProgress: () => null
    },
    "../lib/subscription": {
      getMyBetaAccess: async () => { downstreamReads.push("beta"); return { active: false, startsAt: null, expiresAt: null }; },
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

  return { effects, render, state, timers, trackedEvents, downstreamReads };
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

// Exercise the unchanged repository wrapper with the installed SDK. No live
// project, token, mailbox, storage credentials or provider requests are used.
function readCurrentUserWith(client) {
  const repositorySource = fs.readFileSync(new URL("../lib/supabase-site-repository.ts", import.meta.url), "utf8");
  const repositoryCode = ts.transpileModule(repositorySource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const dependencies = {
    "./site-config": {},
    "./supabase-browser": { getSupabaseBrowserClient: () => client },
    "./site-design": {},
    "./site-legal": {},
    "./product-i18n": {},
    "./published-domain": {}
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", repositoryCode)(name => {
    assert.ok(name in dependencies, name);
    return dependencies[name];
  }, module, module.exports);
  return module.exports.getCurrentUser;
}

for (const locale of ["fr", "en"]) {
  test(`an empty SDK session renders the ${locale} guest journey without reading account data`, async () => {
    let fetches = 0;
    const client = supabaseSdk.createClient("https://recipe.example.invalid", "fixture-public-key", {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true,
        storage: { getItem: () => null, setItem() {}, removeItem() {} } },
      global: { fetch: async () => { fetches += 1; throw new Error("unexpected provider request"); } }
    });
    try {
      const readSession = readCurrentUserWith(client);
      await assert.rejects(readSession(), error => supabaseSdk.isAuthSessionMissingError(error));
      const page = fixture({ readSession, locale });
      page.render();
      page.effects[0]();
      // A real SDK session read includes asynchronous initialization and locking.
      for (let index = 0; index < 10; index += 1) await flush();
      assert.equal(page.state[1], "guest");
      assert.equal(page.state[0], localDraft);
      assert.equal(page.state[4], false, "no entitlement is granted");
      assert.equal(page.state[5], false, "no AI capability is granted");
      assert.equal(page.state[6], null);
      assert.deepEqual(page.downstreamReads, []);
      assert.deepEqual(page.trackedEvents, []);
      assert.equal(fetches, 0);
      const tree = page.render();
      assert.ok(find(tree, node => node.props?.href === "/login" &&
        textContent(node).includes(locale === "en" ? "Sign in" : "Se connecter")));
      assert.match(textContent(tree), locale === "en" ? /Sign-in required/ : /Connexion nécessaire/);
      assert.doesNotMatch(textContent(tree), /Connection temporarily unavailable|Connexion momentanément indisponible/);
    } finally {
      await client.auth.stopAutoRefresh();
    }
  });
}

const impostor = new Error("Auth session missing!");
impostor.name = "AuthSessionMissingError";
for (const [label, error] of [
  ["network", new TypeError("Failed to fetch")],
  ["invalid JWT", new supabaseSdk.AuthApiError("invalid JWT", 401, "bad_jwt")],
  ["missing refresh token", new supabaseSdk.AuthApiError("refresh missing", 400, "refresh_token_not_found")],
  ["provider outage", new supabaseSdk.AuthApiError("unavailable", 503, "unexpected_failure")],
  ["same error name without SDK type", impostor]
]) {
  test(`${label} remains an error on the guest-capable home page`, async () => {
    const page = fixture({ readSession: async () => { throw error; } });
    page.render();
    page.effects[0]();
    await flush();
    assert.equal(page.state[1], "error");
    assert.deepEqual(page.downstreamReads, []);
    assert.ok(find(page.render(), node => node.type === "button" && textContent(node).includes("Try again")));
    assert.equal(page.state[0], localDraft);
  });
}

for (const [code, status, expected] of [
  ["session_not_found", 401, "guest"],
  ["bad_jwt", 401, "error"],
  ["refresh_token_not_found", 400, "error"],
  ["unexpected_failure", 503, "error"]
]) {
  test(`the real SDK maps provider ${code} to the ${expected} home state`, async () => {
    let fetches = 0;
    const session = {
      access_token: "synthetic-token", refresh_token: "synthetic-refresh",
      expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer",
      user: { id: "synthetic-user", aud: "authenticated" }
    };
    const client = supabaseSdk.createClient("https://recipe.example.invalid", "fixture-public-key", {
      auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false,
        storage: {
          getItem: key => key === "sb-recipe-auth-token" ? JSON.stringify(session) : null,
          setItem() {}, removeItem() {}
        } },
      global: { fetch: async (_url, init) => {
        assert.equal(init.method, "GET");
        fetches += 1;
        return new Response(JSON.stringify({ code, message: code }), {
          status, headers: { "content-type": "application/json", "x-supabase-api-version": "2024-01-01" }
        });
      } }
    });
    try {
      const page = fixture({ readSession: readCurrentUserWith(client) });
      page.render();
      page.effects[0]();
      // Yield once for Response.json() and the real SDK's asynchronous lock.
      await new Promise(resolve => setImmediate(resolve));
      await flush();
      assert.equal(page.state[1], expected);
      assert.equal(fetches, 1, "one mocked GET and no repair, logout or refresh request");
      assert.deepEqual(page.downstreamReads, []);
      assert.deepEqual(page.trackedEvents, []);
      assert.equal(page.state[4], false);
      assert.equal(page.state[5], false);
    } finally {
      await client.auth.stopAutoRefresh();
    }
  });
}
