import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("RUN/GROW/BUILD beta switch stays explicitly gated to beta accounts", () => {
  const home = source("../app/page.tsx");
  const builder = source("../app/builder/page.tsx");
  const offers = source("../app/plans/page.tsx");
  assert.match(home, /\{betaAccess\.active \? \(/);
  assert.match(builder, /\{betaTester \? \(\s*<BetaExperienceSwitch/);
  assert.match(offers, /loaded && betaAccess\.active \? \(\s*<BetaExperienceSwitch/);
});

test("beta selection does not mutate subscription or grant paid rights", () => {
  const beta = source("../components/BetaExperienceSwitch.tsx");
  const modes = source("../lib/beta-experience-mode.ts");
  const home = source("../app/page.tsx");
  assert.match(beta, /onChange\("architect"\)/);
  assert.match(modes, /"essential" \| "growth" \| "architect"/);
  assert.match(home, /betaExperienceMode !== "architect" \? false : canCreateWithAi/);
  assert.doesNotMatch(beta, /startPlanCheckout|startAiLaunchCheckout|grantBeta/);
});

test("premium IA uses per-site server authorizations and reservations", () => {
  const api = source("../app/api/ai/write/route.ts");
  assert.match(api, /get_my_site_capabilities/);
  assert.match(api, /get_my_site_ai_access/);
  assert.match(api, /reserve_my_site_launch_operation/);
  assert.match(api, /reserve_my_site_heavy_ai/);
  assert.match(api, /if \(field === "siteArchitect" && access\?\.can_create_site !== true\)/);
  assert.match(api, /if \(field === "siteRevision" && access\?\.can_revise_site !== true\)/);
});

test("commercial demo stays static and appears only for eligible Essential buyers", () => {
  const demo = source("../components/AiArchitectDiscovery.tsx");
  const plans = source("../app/plans/page.tsx");
  assert.doesNotMatch(demo, /fetch\(|generatePremiumSiteArchitect|openai|supabase\.rpc/i);
  assert.match(plans, /!betaAccess\.active && current\.planKey === "essential" && !aiAccess\.canCreateSite/);
});
