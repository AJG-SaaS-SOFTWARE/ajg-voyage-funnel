import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const helperSource = fs.readFileSync(new URL("../lib/growth-health.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/growth/page.tsx", import.meta.url), "utf8");
const home = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const plans = fs.readFileSync(new URL("../app/plans/page.tsx", import.meta.url), "utf8");

const code = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const module = { exports: {} };
new Function("module", "exports", code)(module, module.exports);
const { growthHealthCounts, groupGrowthHealthChecks } = module.exports;

test("Growth health summary counts deterministic check states", () => {
  const counts = growthHealthCounts([
    { key: "publication", label: "Publication", status: "healthy", detail: "" },
    { key: "seo", label: "SEO", status: "action", detail: "" },
    { key: "storage", label: "Storage", status: "incident", detail: "" },
    { key: "contact", label: "Contact", status: "healthy", detail: "" }
  ]);
  assert.deepEqual(counts, { healthy: 2, action: 1, incident: 1 });
});

test("Growth health groups preserve the strongest status in each area", () => {
  const groups = groupGrowthHealthChecks([
    { key: "publication", label: "Publication", status: "healthy", detail: "" },
    { key: "latency", label: "Latency", status: "action", detail: "" },
    { key: "seo", label: "SEO", status: "healthy", detail: "" },
    { key: "sitemap", label: "Sitemap", status: "incident", detail: "" },
    { key: "contact", label: "Contact", status: "healthy", detail: "" }
  ]);
  assert.equal(groups.find((group) => group.key === "availability").status, "action");
  assert.equal(groups.find((group) => group.key === "visibility").status, "incident");
  assert.equal(groups.find((group) => group.key === "content").status, "healthy");
});

test("Growth cockpit is gated by plan, beta simulation mode and first publication", () => {
  assert.match(page, /entitlements\.planKey === "growth"/);
  assert.match(page, /beta\.active \? resolvedMode === "growth" : paidGrowth/);
  assert.match(page, /selected\.status !== "published"/);
  assert.match(page, /Vous testez actuellement Essentiel/);
  assert.match(page, /Tester Growth maintenant/);
});

test("Growth cockpit reuses deterministic Health Center checks without premium AI scan", () => {
  assert.match(page, /\/api\/support\/health\?siteId=/);
  assert.match(page, /supportGuidanceForCheck/);
  assert.match(page, /ne déclenche pas de modèle IA Premium|n’utilise pas de modèle IA Premium/);
  assert.doesNotMatch(page, /\/api\/ai\/write|\/api\/ai\//);
});

test("published Growth accounts receive a dashboard entry to the cockpit", () => {
  assert.match(home, /growthExperienceAvailable/);
  assert.match(home, /draft\?\.status === "published"/);
  assert.match(home, /planKey === "growth"/);
  assert.match(home, /href="\/growth"/);
});


test("active Growth offer exposes the cockpit from My plan", () => {
  assert.match(plans, /displayedPlanKey === "growth"/);
  assert.match(plans, /href="\/growth"/);
  assert.match(plans, /Ouvrir le pilotage Growth/);
});


test("Growth explains every non-healthy check instead of using the support page four-item cap", () => {
  assert.match(page, /supportGuidanceForCheck\(check, locale\)/);
  assert.doesNotMatch(page, /supportGuidanceForDiagnosis/);
  assert.match(page, /ELTARA a détecté un écart qui mérite votre attention/);
});
