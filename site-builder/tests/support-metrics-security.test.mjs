import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(
  new URL("../app/api/admin/support/route.ts", import.meta.url),
  "utf8"
);
const page = fs.readFileSync(
  new URL("../app/admin/support/page.tsx", import.meta.url),
  "utf8"
);

test("support KPI queries run only after admin authorization", () => {
  const auth = route.indexOf("const auth = await requireAdmin(request)");
  const guard = route.indexOf('if ("response" in auth) return auth.response');
  const events = route.indexOf('.from("support_ticket_events")');
  const remediations = route.indexOf('.from("support_remediation_runs")');
  assert.ok(auth >= 0);
  assert.ok(guard > auth);
  assert.ok(events > guard);
  assert.ok(remediations > guard);
});

test("support KPI failure does not hide the operational ticket queue", () => {
  assert.match(route, /const metrics = metricError\s*\? null/);
  assert.match(route, /tickets: queue\.data \|\| \[\], metrics/);
});

test("admin support shows the explicit human-support target", () => {
  assert.match(page, /cible &lt; 0,15/);
  assert.match(page, /résolus sans admin/);
  assert.match(page, /Réparations techniques/);
});
