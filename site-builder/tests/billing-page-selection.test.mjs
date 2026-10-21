import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";

const sites = [{ id: "site-a", slug: "a" }, { id: "site-b", slug: "b" }];
const flush = async () => { for (let i = 0; i < 32; i++) await Promise.resolve(); };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
function harness(
  getBilling,
  search = "?siteId=site-b",
  getSites = async () => sites,
  getEntitlements = async () => ({ planKey: "free", status: "active" }),
  locale = "fr"
) {
  const state = [];
  let cursor, effect, cleanup;
  const calls = [];
  const rightsCalls = [];
  const timers = [];
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = value; }];
    },
    useEffect(callback) { effect = callback; },
    useRef(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = { current: initial };
      return state[index];
    }
  };
  const code = ts.transpileModule(fs.readFileSync(new URL("../app/billing/page.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText;
  const loaded = { exports: {} };
  const dependencies = {
    react: hooks,
    "react/jsx-runtime": jsx,
    "../../components/AccountShell": { AccountShell: ({ children }) => jsx.jsx("account-shell", { children }) },
    "../../lib/billing-access": { getMyBillingState: id => { calls.push(id); return getBilling(id); } },
    "../../lib/supabase-site-repository": { getMySites: getSites },
    "../../lib/product-i18n": { useProductLocale: () => ({ locale, tr: (fr, en) => locale === "en" ? en : fr }) },
    "../../lib/billing-guidance": { billingGuide: () => [], billingStateLabel: value => value },
    "../../lib/subscription": { getMySiteEntitlements: id => { rightsCalls.push(id); return getEntitlements(id); } }
  };
  new Function("require", "module", "exports", "window", code)(name => {
    assert.ok(name in dependencies, name);
    return dependencies[name];
  }, loaded, loaded.exports, {
    location: { search },
    setTimeout(callback, delay) {
      timers.push(delay);
      queueMicrotask(callback);
      return timers.length;
    },
    clearTimeout() {}
  });
  function nodes(node) {
    if (Array.isArray(node)) return node.flatMap(nodes);
    if (!node || typeof node !== "object") return [];
    return [node, ...nodes(node.props?.children)];
  }
  return {
    state, calls, rightsCalls, timers,
    render() { cleanup?.(); cursor = 0; loaded.exports.default(); cleanup = effect(); },
    tree() { cursor = 0; return loaded.exports.default(); },
    retryButton() {
      return nodes(this.tree()).find(node =>
        node.type === "button" && node.props["data-action"] === "verify-checkout-entitlements"
      );
    },
    select(id) { state[3] = id; this.render(); },
    unmount() { cleanup?.(); }
  };
}

test("billing follows the owned website requested by the Stripe return URL", async () => {
  const page = harness(async id => ({ state: "active", site: id }));
  page.render();
  await flush();
  assert.equal(page.state[3], "site-b");
  page.render();
  await flush();
  assert.deepEqual(page.calls, ["site-b"]);
  assert.equal(page.state[0].site, "site-b");
  assert.equal(page.state[5], false);
});

test("a slow response for the previous site cannot replace the selected site's billing", async () => {
  const old = deferred();
  const page = harness(id => id === "site-a" ? old.promise : Promise.resolve({ state: "active", site: id }), "?siteId=site-a");
  page.render(); await flush(); page.render(); await flush();
  page.select("site-b");
  assert.equal(page.state[0], null);
  assert.equal(page.state[5], true);
  await flush();
  old.resolve({ state: "restricted", site: "site-a" });
  await flush();
  assert.equal(page.state[0].site, "site-b");
  assert.equal(page.state[5], false);
});

test("current read failures show a recoverable error, while obsolete failures are ignored", async () => {
  const old = deferred();
  const page = harness(id => id === "site-a" ? old.promise : Promise.reject(new Error("private marker")), "?siteId=site-a");
  page.render(); await flush(); page.render(); await flush();
  page.select("site-b"); await flush();
  assert.equal(page.state[1], "Impossible de charger l’état de facturation.");
  assert.equal(page.state[5], false);
  old.reject(new Error("obsolete")); await flush();
  assert.equal(page.state[1], "Impossible de charger l’état de facturation.");
  assert.equal(page.state[0], null);
});

test("a hung billing read times out and a late response cannot overwrite the recoverable error", async () => {
  const late = deferred();
  const page = harness(() => late.promise);
  page.render(); await flush(); page.render(); await flush();
  assert.deepEqual(page.calls, ["site-b"]);
  assert.equal(page.state[0], null);
  assert.equal(page.state[5], false);
  assert.equal(page.state[1], "Impossible de charger l’état de facturation.");
  assert.deepEqual(page.timers, [10_000]);

  late.resolve({ state: "active", site: "site-b" });
  await flush();
  assert.equal(page.state[0], null);
  assert.equal(page.state[1], "Impossible de charger l’état de facturation.");
});

test("unowned URL targets never trigger a billing read and empty accounts finish loading", async () => {
  const page = harness(async id => ({ state: "active", site: id }), "?siteId=not-owned");
  page.render(); await flush(); page.render(); await flush();
  assert.deepEqual(page.calls, ["site-a"]);
  const empty = harness(async () => { throw new Error("unexpected"); }, "", async () => []);
  empty.render(); await flush();
  assert.equal(empty.state[5], false);
  assert.deepEqual(empty.calls, []);
});


test("a Checkout return confirms only server-side paid entitlements and tolerates webhook lag", async () => {
  let read = 0;
  const page = harness(
    async id => ({ state: "active", site: id }),
    "?checkout=success&siteId=site-b",
    async () => sites,
    async () => (++read < 3
      ? { planKey: "free", status: "active" }
      : { planKey: "essential", status: "active" })
  );
  page.render(); await flush(); page.render(); await flush();
  assert.deepEqual(page.rightsCalls, ["site-b", "site-b", "site-b"]);
  assert.deepEqual(page.timers, [10_000, 5_000, 1_500, 5_000, 1_500, 5_000, 10_000]);
  assert.equal(page.state[0].site, "site-b");
  assert.equal(page.state[1], "Vos droits d’abonnement sont confirmés côté serveur.");
  assert.equal(page.state[5], false);
});

test("confirmed Checkout rights survive a billing display refresh failure", async () => {
  let billingRead = 0;
  const page = harness(
    async id => {
      if (++billingRead === 1) return { state: "active", site: id };
      throw new Error("private billing refresh failure");
    },
    "?checkout=success&siteId=site-b",
    async () => sites,
    async () => ({ planKey: "essential", status: "active" })
  );
  page.render(); await flush(); page.render(); await flush();
  assert.equal(page.calls.length, 2);
  assert.equal(page.state[0].site, "site-b", "keep the last billing snapshot");
  assert.equal(page.state[6], "", "confirmed rights must not remain retryable");
  assert.equal(page.retryButton(), undefined);
  assert.equal(
    page.state[1],
    "Vos droits d’abonnement sont confirmés côté serveur, mais l’affichage de facturation n’a pas pu être actualisé. Actualisez la page pour réessayer."
  );
  assert.doesNotMatch(page.state[1], /private billing refresh failure/);
});

test("a Checkout return stays explicitly unconfirmed after the bounded server-rights checks", async () => {
  const page = harness(
    async id => ({ state: "active", site: id }),
    "?checkout=success&siteId=site-b"
  );
  page.render(); await flush(); page.render(); await flush();
  assert.equal(page.rightsCalls.length, 4);
  assert.deepEqual(page.timers, [10_000, 5_000, 1_500, 5_000, 1_500, 5_000, 1_500, 5_000]);
  assert.match(page.state[1], /pas encore confirmés/);
  assert.doesNotMatch(page.state[1], /paiement (réussi|confirmé)/i);
  assert.equal(page.state[5], false);
  assert.equal(page.state[6], "site-b");
  assert.equal(page.retryButton().props.disabled, false);
});

test("hung entitlement reads time out and release both automatic and manual checks", async () => {
  const never = new Promise(() => {});
  const page = harness(
    async id => ({ state: "active", site: id }),
    "?checkout=success&siteId=site-b",
    async () => sites,
    async () => never
  );
  page.render(); await flush(); page.render(); await flush(); await flush();
  assert.equal(page.rightsCalls.length, 4);
  assert.equal(page.state[5], false);
  assert.equal(page.state[6], "site-b");
  assert.equal(page.retryButton().props.disabled, false);
  assert.equal(page.timers.filter(delay => delay === 5_000).length, 4);

  page.retryButton().props.onClick();
  await flush(); await flush();
  assert.equal(page.rightsCalls.length, 8);
  assert.equal(page.state[7], false);
  assert.equal(page.state[6], "site-b");
  assert.equal(page.retryButton().props.disabled, false);
  assert.match(page.state[1], /pas encore confirmés/);
  assert.equal(page.timers.filter(delay => delay === 5_000).length, 8);
});

test("a manual recheck is single-flight and refreshes billing only after server rights are confirmed", async () => {
  let read = 0;
  const page = harness(
    async id => ({ state: "active", site: id }),
    "?checkout=success&siteId=site-b",
    async () => sites,
    async () => (++read <= 4
      ? { planKey: "free", status: "active" }
      : { planKey: "growth", status: "active" })
  );
  page.render(); await flush(); page.render(); await flush();
  const retry = page.retryButton();
  retry.props.onClick();
  retry.props.onClick();
  await flush();
  assert.deepEqual(page.rightsCalls, ["site-b", "site-b", "site-b", "site-b", "site-b"]);
  assert.equal(page.calls.length, 2, "refresh billing once after confirmed rights");
  assert.equal(page.state[6], "");
  assert.equal(page.state[7], false);
  assert.equal(page.state[1], "Vos droits d’abonnement sont confirmés côté serveur.");
  assert.equal(page.retryButton(), undefined);
});

test("manual confirmation remains successful when only the English billing display refresh fails", async () => {
  let billingRead = 0;
  let rightsRead = 0;
  const page = harness(
    async id => {
      if (++billingRead === 1) return { state: "active", site: id };
      throw new Error("private billing refresh failure");
    },
    "?checkout=success&siteId=site-b",
    async () => sites,
    async () => (++rightsRead <= 4
      ? { planKey: "free", status: "active" }
      : { planKey: "growth", status: "active" }),
    "en"
  );
  page.render(); await flush(); page.render(); await flush();
  page.retryButton().props.onClick();
  await flush();
  assert.equal(page.calls.length, 2);
  assert.equal(page.state[0].site, "site-b", "keep the last billing snapshot");
  assert.equal(page.state[6], "");
  assert.equal(page.state[7], false);
  assert.equal(page.retryButton(), undefined);
  assert.equal(
    page.state[1],
    "Your subscription entitlements are confirmed server-side, but the billing display could not be refreshed. Refresh the page to try again."
  );
  assert.doesNotMatch(page.state[1], /private billing refresh failure/);
});

test("forged or unrelated URL targets never trigger Checkout entitlement confirmation", async () => {
  for (const search of ["?checkout=success&siteId=not-owned", "?checkout=cancel&siteId=site-b", "?siteId=site-b"]) {
    const page = harness(async id => ({ state: "active", site: id }), search);
    page.render(); await flush(); page.render(); await flush();
    assert.deepEqual(page.rightsCalls, []);
    assert.deepEqual(page.timers, [10_000]);
  }
});


test("English Checkout return copy distinguishes confirmed server rights from an uncertain return", async () => {
  for (const [rights, expected] of [
    [{ planKey: "growth", status: "active" }, "Your subscription entitlements are confirmed server-side."],
    [{ planKey: "free", status: "active" }, "Payment flow return detected, but your server-side entitlements are not confirmed yet. You can check again in a few moments."]
  ]) {
    const page = harness(
      async id => ({ state: "active", site: id }),
      "?checkout=success&siteId=site-b",
      async () => sites,
      async () => rights,
      "en"
    );
    page.render(); await flush(); page.render(); await flush();
    assert.equal(page.state[1], expected);
  }
});
