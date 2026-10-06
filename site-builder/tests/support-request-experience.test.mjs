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
    "../../lib/support-guidance": { supportGuidanceForDiagnosis: () => [] },
    "../../lib/support-knowledge": { supportArticlesForLocale: () => [] }
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", "fetch", "window", code)(
    (name) => { assert.ok(name in dependencies, `Unexpected dependency: ${name}`); return dependencies[name]; },
    module, module.exports,
    async (url, options) => { calls.push({ url, ...options }); return fetch(url, options); },
    { location: { search: "" } }
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
    async mount() { effects[0](); await new Promise(setImmediate); }
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
    ? response(201, { ticket: { id: "synthetic-ticket", status: "diagnosed" } })
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
    ? response(201, { ticket: { id: "synthetic-ticket", status: "diagnosed" } })
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
  finish(response(201, { ticket: { id: "synthetic-ticket", status: "diagnosed" } }));
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
    ? response(201, { ticket: { id: "synthetic-ticket", status: "waiting_customer" } })
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
});

test("missing session never sends a request", async () => {
  const app = harness({ session: false });
  app.fill();
  await app.submit();
  assert.equal(app.calls.length, 0);
  assert.equal(app.find("form"), undefined);
});
