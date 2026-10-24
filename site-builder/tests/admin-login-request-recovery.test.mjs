import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../app/admin/login/page.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX
} }).outputText;

function fixture({ signOut, send }) {
  const slots = [];
  const timers = new Map();
  const linkRequests = [];
  let cursor = 0;
  let nextTimer = 1;
  let signOutCalls = 0;
  const element = (type, props) => ({ type, props });
  const dependencies = {
    "react/jsx-runtime": { jsx: element, jsxs: element },
    react: {
      useEffect() {},
      useState(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = initial;
        return [slots[index], value => { slots[index] = value; }];
      },
      useRef(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = { current: initial };
        return slots[index];
      }
    },
    "next/link": { default: "a" },
    "next/navigation": { useRouter: () => ({ replace() { throw new Error("unexpected redirect"); } }) },
    "../../../lib/supabase-browser": {
      isSupabaseConfigured: () => true,
      getSupabaseBrowserClient: () => ({ auth: {
        getSession: async () => ({ data: { session: null } }),
        signOut: async () => { signOutCalls += 1; return signOut(signOutCalls); },
        signInWithOtp: async input => { linkRequests.push(input); return send(input); }
      } })
    },
    "../../../components/EltaraBrand": { EltaraBrand: "brand" },
    "../../../lib/admin": { isCurrentUserAdmin: async () => false }
  };
  const window = {
    location: { origin: "https://eltara.example" },
    setTimeout(callback) { const id = nextTimer++; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); }
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", "window", code)(name => {
    assert.ok(name in dependencies, name);
    return dependencies[name];
  }, module, module.exports, window);
  function render() { cursor = 0; return module.exports.default(); }
  function find(node, predicate) {
    if (!node || typeof node !== "object") return undefined;
    if (predicate(node)) return node;
    for (const child of [node.props?.children].flat(Infinity)) {
      const result = find(child, predicate);
      if (result) return result;
    }
  }
  function byType(type) { return find(render(), node => node.type === type); }
  function enter(email) { byType("input").props.onChange({ target: { value: email } }); }
  function submit() { return byType("form").props.onSubmit({ preventDefault() {} }); }
  function expireActiveDeadline() {
    const active = [...timers.values()];
    assert.equal(active.length, 1);
    active[0]();
  }
  return { byType, enter, expireActiveDeadline, linkRequests, render, submit, get signOutCalls() { return signOutCalls; } };
}

test("simultaneous admin login submissions send only one link", async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const f = fixture({ signOut: async () => ({ error: null }), send: () => pending });
  f.enter("admin@example.invalid");
  const first = f.submit();
  const second = f.submit();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.signOutCalls, 1);
  assert.equal(f.linkRequests.length, 1);
  finish({ error: null });
  await Promise.all([first, second]);
  assert.equal(f.byType("form"), undefined);
});

test("an unconfirmed sign-out never requests a link and a manual retry remains possible", async () => {
  const f = fixture({
    signOut: async attempt => attempt === 1 ? { error: { message: "private-provider-marker" } } : { error: null },
    send: async () => ({ error: null })
  });
  f.enter("admin@example.invalid");
  await f.submit();
  assert.equal(f.linkRequests.length, 0);
  assert.equal(f.byType("button").props.disabled, false);
  assert.equal(JSON.stringify(f.render()).includes("private-provider-marker"), false);
  assert.match(JSON.stringify(f.render()), /Aucun nouveau lien administrateur n’a été demandé/);
  await f.submit();
  assert.equal(f.linkRequests.length, 1);
  assert.equal(f.byType("form"), undefined);
});

test("a timed-out sign-out cannot request a link after its late response", async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const f = fixture({ signOut: () => pending, send: async () => ({ error: null }) });
  f.enter("admin@example.invalid");
  const submission = f.submit();
  f.expireActiveDeadline();
  await submission;
  assert.equal(f.linkRequests.length, 0);
  finish({ error: null });
  await Promise.resolve();
  assert.equal(f.linkRequests.length, 0);
  assert.equal(f.byType("button").props.disabled, false);
});

test("an uncertain link response is not retried and keeps provider details private", async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const f = fixture({ signOut: async () => ({ error: null }), send: () => pending });
  f.enter("  admin@example.invalid  ");
  const submission = f.submit();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.linkRequests.length, 1);
  f.expireActiveDeadline();
  await submission;
  assert.equal(f.linkRequests.length, 1);
  assert.equal(f.byType("button").props.disabled, false);
  const output = JSON.stringify(f.render());
  assert.equal(output.includes("private-provider-marker"), false);
  assert.match(output, /Vérifiez votre boîte mail et les indésirables/);
  assert.deepEqual(f.linkRequests[0], {
    email: "admin@example.invalid",
    options: { emailRedirectTo: "https://eltara.example/admin", shouldCreateUser: false }
  });
  finish({ error: { message: "private-provider-marker" } });
  await Promise.resolve();
  assert.equal(f.linkRequests.length, 1);
  assert.notEqual(f.byType("form"), undefined);
});
