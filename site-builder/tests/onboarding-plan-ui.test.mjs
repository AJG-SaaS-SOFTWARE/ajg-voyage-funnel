import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const home = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const builder = fs.readFileSync(new URL("../app/builder/page.tsx", import.meta.url), "utf8");

test("dashboard verifies site entitlements before offering full AI creation", () => {
  assert.match(home, /getMySiteEntitlements\(remote\.id\)/);
  assert.match(home, /getMySiteAiAccess\(remote\.id\)/);
  assert.match(home, /creationPath\.mode === "ai_available"/);
  assert.match(home, /\/builder\?step=story&focus=architect/);
});

test("AI onboarding deep link opens and scrolls to the architect", () => {
  assert.match(builder, /focus !== "architect"/);
  assert.match(builder, /getElementById\("ai-site-architect"\)/);
  assert.match(builder, /id="ai-site-architect"/);
  assert.match(builder, /node\.open = true/);
  assert.match(builder, /scrollIntoView/);
});
