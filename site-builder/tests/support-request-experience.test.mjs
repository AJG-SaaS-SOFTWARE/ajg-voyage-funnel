import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

// Execute the real page handlers with isolated hooks and HTTP responses.
// No Supabase client, real session or customer ticket is used.
const source = fs.readFileSync(new URL("../app/support/page.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
const health = { siteId: null, diagnosis: { overall: "healthy", checks: [] } };
const response = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

function harness({ fetch, session = true, locale = "fr" } = {}) {
  const states = [], refs = [], effects = [], calls = [];
  let cursor = 0, refCursor = 0;
  const hooks = {
    useState(initial) {
      const slot = cursor++;
      if (!(slot in states)) states[slot] = initial;
      return [states[slot], (value) => { states[slot] = typeof value === "function" ? value(states[slot]) : value; }];
    },
    useRef(initial) { const slot = refCursor++; return refs[slot] ??= { current: initial }; },
    useEffect(effect) { if (!effects.length) effects.push(effect); }
  };
  const jsx = (type, props) => ({ type, props });
  const dependencies = {
    react: hooks,
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "next/link": { default: "link" },
    "../../components/LanguageSwitch": { LanguageSwitch: "language-switch" },
    "../../lib/product-i18n": { useProductLocale: () => ({ locale, tr: (fr, en) => locale === "fr" ? fr : en }) },
    "../../lib/supabase-browser": {
      getSupabaseBrowserClient: () => ({ auth: { getSession: async () => ({ data: { session: session ? { access_token: "isolated-test-token" } : null } }) } })
    },
    "../../lib/support-guidance": {
      supportGuidanceForDiagnosis: () => [],
      supportCheckDisplay: (check) => ({
        title: check.label,
        detail: check.detail,
        action: check.clientAction || null
      }),
      supportTicketStatusLabel: (status) => status
    },
    "../../lib/support-knowledge": { supportArticlesForLocale: () => [] }
  };
  const module = { exports: {} };
  let identitySequence = 0;
  new Function("require", "module", "exports", "fetch", "window", "crypto", code)(
    (name) => { assert.ok(name in dependencies, `Unexpected dependency: ${name}`); return dependencies[name]; },
    module, module.exports,
    async (url, options) => { calls.push({ url, ...options }); return fetch(url, options); },
    { location: { search: "" } },
    { randomUUID: () => `00000000-0000-4000-8000-${String(++identitySequence).padStart(12, "0")}` }
  );
  const render = () => { cursor = 0; refCursor = 0; return module.exports.default(); };
  const nodes = (tree) => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : [];
  const find = (type) => nodes(render()).find((node) => node.type === type);
  const text = (tree) => Array.isArray(tree) ? tree.map((node) => text(node)).join(" ") : tree && typeof tree === "object" ? text(tree.props?.children) : tree ?? "";
  const fill = () => {
    find("input").props.onChange({ target: { value: "Synthetic support request" } });
    find("textarea").props.onChange({ target: { value: "Synthetic description for the isolated test." } });
  };
  render();
  return { calls, render, nodes, find, text: () => text(render()), fill,
    submit: () => find("form").props.onSubmit({ preventDefault() {} }),
    async mount() { effects[0](); await new Promise(setImmediate); },
    async refresh() {
      const button = nodes(render()).find((node) => node.type === "button" && ["Actualiser mes demandes", "Diagnostiquer mon site"].includes(node.props.children));
      assert.ok(button, "Refresh action must remain accessible");
      button.props.onClick();
      await new Promise(setImmediate);
    }
  };
}

test("request form is available before diagnosis and links to improvement requests", () => {
  const app = harness();
  assert.ok(app.find("form"));
  assert.ok(app.nodes(app.render()).some((node) => node.props?.href === "/feedback"));
  assert.ok(app.nodes(app.render()).some((node) => node.props?.href === "#new-request"));
});

test("initial GET failure keeps the request form and a refresh action", async () => {
  const app = harness({ fetch: async () => response(503, { error: "Synthetic outage" }) });
  await app.mount();
  assert.ok(app.find("form"));
  assert.match(app.text(), /Actualiser mes demandes/);
});

test("confirmed POST remains saved when the subsequent GET fails", async () => {
  const app = harness({ fetch: async (_, options) => options.method === "POST"
    ? response(201, { ticket: { id: JSON.parse(options.body).requestId, status: "diagnosed" } })
    : response(503, { error: "Synthetic outage" }) });
  app.fill();
  await app.submit();
  assert.match(app.text(), /Ticket enregistré/);
  assert.match(app.text(), /ne l’envoyez pas une seconde fois/);
  assert.doesNotMatch(app.text(), /Création impossible/);
  assert.equal(app.find("input").props.value, "");
  assert.equal(app.find("textarea").props.value, "");
  assert.equal(app.calls.filter((call) => call.method === "POST").length, 1);
});

test("confirmed request and refreshed list are displayed in English", async () => {
  const app = harness({ locale: "en", fetch: async (_, options) => options.method === "POST"
    ? response(201, { ticket: { id: JSON.parse(options.body).requestId, status: "diagnosed" } })
    : response(200, { health, tickets: [] }) });
  app.fill();
  await app.submit();
  assert.match(app.text(), /Ticket saved/);
  assert.match(app.text(), /My requests/);
  assert.equal(app.calls.length, 2);
});

test("concurrent submissions perform one POST until its response is received", async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const app = harness({ fetch: async (_, options) => options.method === "POST" ? pending : response(200, { health, tickets: [] }) });
  app.fill();
  const first = app.submit();
  const second = app.submit();
  await new Promise(setImmediate);
  assert.equal(app.calls.length, 1);
  assert.equal(app.find("form").props["aria-busy"], true);
  assert.equal(app.find("input").props.disabled, true);
  assert.equal(app.find("textarea").props.disabled, true);
  finish(response(201, { ticket: { id: JSON.parse(app.calls[0].body).requestId, status: "diagnosed" } }));
  await Promise.all([first, second]);
  assert.equal(app.calls.filter((call) => call.method === "POST").length, 1);
  assert.equal(app.find("form").props["aria-busy"], false);
});

test("rejected POST preserves the draft and performs no refresh or automatic retry", async () => {
  const app = harness({ fetch: async () => response(429, { error: "Synthetic rate limit" }) });
  app.fill();
  await app.submit();
  assert.match(app.text(), /Synthetic rate limit/);
  assert.equal(app.find("input").props.value, "Synthetic support request");
  assert.equal(app.calls.length, 1);
});

test("lost POST response preserves the draft and tells the user to reconcile", async () => {
  const app = harness({ fetch: async () => { throw new Error("Synthetic connection loss"); } });
  app.fill();
  await app.submit();
  assert.match(app.text(), /peut-être été enregistrée/);
  assert.match(app.text(), /actualisez vos demandes avant de réessayer/);
  assert.equal(app.find("input").props.value, "Synthetic support request");
  assert.equal(app.calls.length, 1);
});

test("server failure is an unconfirmed submission and is not retried", async () => {
  const app = harness({ fetch: async () => response(500, { error: "Synthetic server failure" }) });
  app.fill();
  await app.submit();
  assert.match(app.text(), /Actualisez vos demandes avant de réessayer/);
  assert.doesNotMatch(app.text(), /Ticket enregistré/);
  assert.equal(app.find("input").props.value, "Synthetic support request");
  assert.equal(app.calls.length, 1);
});

test("saved ticket requiring customer action remains confirmed without refreshed history", async () => {
  const app = harness({ fetch: async (_, options) => options.method === "POST"
    ? response(201, { ticket: { id: JSON.parse(options.body).requestId, status: "waiting_customer" } })
    : response(503, {}) });
  app.fill();
  await app.submit();
  assert.match(app.text(), /Demande enregistrée/);
  assert.match(app.text(), /ne l’envoyez pas une seconde fois/);
  assert.equal(app.calls.filter((call) => call.method === "POST").length, 1);
});

test("malformed successful POST is not claimed as saved", async () => {
  const app = harness({ fetch: async () => response(201, { ticket: {} }) });
  app.fill();
  await app.submit();
  assert.match(app.text(), /n’a pas pu être confirmé/);
  assert.doesNotMatch(app.text(), /Ticket enregistré/);
  assert.equal(app.find("input").props.value, "Synthetic support request");
  assert.equal(app.calls.length, 1);
});

test("expired session during initial load hides submission and offers login", async () => {
  const app = harness({ fetch: async () => response(401, { error: "Synthetic expired session" }) });
  await app.mount();
  assert.equal(app.find("form"), undefined);
  assert.match(app.text(), /Connexion requise/);
  assert.equal(app.find("a").props.href, "/login");
});

test("missing session never sends a request", async () => {
  const app = harness({ session: false });
  app.fill();
  await app.submit();
  assert.equal(app.calls.length, 0);
  assert.equal(app.find("form"), undefined);
});

test("manual retry after a lost response reuses the same identity", async () => {
  let posts = 0;
  const app = harness({ fetch: async (_, options) => {
    if (options.method !== "POST") return response(200, { health, tickets: [] });
    if (++posts === 1) throw new Error("Synthetic lost response");
    return response(201, { ticket: { id: JSON.parse(options.body).requestId, status: "diagnosed" }, replayed: true });
  } });
  app.fill();
  await app.submit();
  await app.submit();
  const submitted = app.calls.filter((call) => call.method === "POST").map((call) => JSON.parse(call.body));
  assert.equal(submitted.length, 2);
  assert.equal(submitted[0].requestId, submitted[1].requestId);
  assert.equal(app.find("input").props.value, "");
  assert.match(app.text(), /Ticket enregistré/);
});

test("quota rejection after an earlier unknown result never rotates the identity", async () => {
  let posts = 0;
  const app = harness({ fetch: async () => ++posts === 1 ? response(503, {}) : response(429, { error: "Synthetic quota" }) });
  app.fill();
  await app.submit();
  await app.submit();
  await app.submit();
  assert.equal(new Set(app.calls.map((call) => JSON.parse(call.body).requestId)).size, 1);
});

test("a changed draft cannot be sent while the first submission is unconfirmed", async () => {
  const app = harness({ fetch: async () => response(503, {}) });
  app.fill();
  await app.submit();
  app.find("textarea").props.onChange({ target: { value: "Different synthetic description" } });
  await app.submit();
  assert.match(app.text(), /Un envoi précédent reste à vérifier/);
  assert.equal(app.calls.length, 1);
});

test("positive refresh reconciles the pending identity and preserves a different new draft", async () => {
  let savedId;
  const app = harness({ fetch: async (_, options) => {
    if (options.method === "POST") {
      savedId = JSON.parse(options.body).requestId;
      throw new Error("Synthetic lost response");
    }
    return response(200, { health, tickets: savedId ? [{ id: savedId, subject: "Synthetic saved request", message: "Synthetic description", status: "diagnosed", created_at: "2026-10-06T00:00:00Z" }] : [] });
  } });
  await app.mount();
  app.fill();
  await app.submit();
  app.find("textarea").props.onChange({ target: { value: "Different synthetic description" } });
  await app.refresh();
  assert.match(app.text(), /Votre demande a été retrouvée/);
  assert.equal(app.find("textarea").props.value, "Different synthetic description");
  const previousId = savedId;
  await app.submit();
  assert.notEqual(savedId, previousId);
});

test("a missing ticket in a refreshed list does not release an uncertain identity", async () => {
  const app = harness({ fetch: async (_, options) => options.method === "POST" ? response(503, {}) : response(200, { health, tickets: [] }) });
  await app.mount();
  app.fill();
  await app.submit();
  await app.refresh();
  await app.submit();
  const posts = app.calls.filter((call) => call.method === "POST");
  assert.equal(JSON.parse(posts[0].body).requestId, JSON.parse(posts[1].body).requestId);
});

test("late initial GET can reconcile a submission without leaving its old draft reusable", async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const app = harness({ fetch: async (_, options) => options.method === "POST" ? response(503, {}) : pending });
  await app.mount();
  app.fill();
  await app.submit();
  const sent = app.calls.find((call) => call.method === "POST");
  release(response(200, { health, tickets: [{ id: JSON.parse(sent.body).requestId, subject: "Synthetic request", message: "Synthetic description", status: "diagnosed", created_at: "2026-10-06T00:00:00Z" }] }));
  await new Promise(setImmediate);
  assert.equal(app.find("input").props.value, "");
  assert.equal(app.find("textarea").props.value, "");
  assert.match(app.text(), /Votre demande a été retrouvée/);
});

test("a different ticket ID in a 201 response is not accepted as confirmation", async () => {
  const app = harness({ fetch: async () => response(201, { ticket: { id: "unrelated-synthetic-ticket" } }) });
  app.fill();
  await app.submit();
  await app.submit();
  assert.match(app.text(), /n’a pas pu être confirmé/);
  assert.equal(JSON.parse(app.calls[0].body).requestId, JSON.parse(app.calls[1].body).requestId);
  assert.equal(app.find("input").props.value, "Synthetic support request");
});

test("a first pre-insert validation rejection allows a corrected draft with a fresh identity", async () => {
  const app = harness({ fetch: async () => response(400, { error: "Synthetic rejection" }) });
  app.fill();
  await app.submit();
  app.find("textarea").props.onChange({ target: { value: "Corrected synthetic description" } });
  await app.submit();
  assert.equal(app.calls.length, 2);
  assert.notEqual(JSON.parse(app.calls[0].body).requestId, JSON.parse(app.calls[1].body).requestId);
});

test("positive GET confirmation cannot be downgraded by a later failed POST response", async () => {
  let finishGet, finishPost;
  const pendingGet = new Promise((resolve) => { finishGet = resolve; });
  const pendingPost = new Promise((resolve) => { finishPost = resolve; });
  const app = harness({ fetch: async (_, options) => options.method === "POST" ? pendingPost : pendingGet });
  await app.mount();
  app.fill();
  const sending = app.submit();
  await new Promise(setImmediate);
  const sent = app.calls.find((call) => call.method === "POST");
  finishGet(response(200, { health, tickets: [{ id: JSON.parse(sent.body).requestId, subject: "Synthetic request", message: "Synthetic description", status: "diagnosed", created_at: "2026-10-06T00:00:00Z" }] }));
  await new Promise(setImmediate);
  app.render();
  finishPost(response(503, {}));
  await sending;
  assert.match(app.text(), /Votre demande a été retrouvée/);
  assert.doesNotMatch(app.text(), /n’a pas pu être confirmé/);
  assert.equal(app.find("input").props.value, "");
});
