import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const routes = [
  "app/api/support/health/route.ts",
  "app/api/support/tickets/route.ts",
  "app/api/domains/remove/route.ts",
  "app/api/domains/sync/route.ts",
  "app/api/media/promote/route.ts",
  "app/api/export/site/route.ts"
];

test("audited customer APIs use the shared server locale layer", () => {
  for (const path of routes) {
    const source = read(path);
    assert.match(source, /requestProductLocale/);
    assert.match(source, /localize/);
  }
});

test("Support APIs no longer return French-only errors", () => {
  const health = read("app/api/support/health/route.ts");
  const tickets = read("app/api/support/tickets/route.ts");

  assert.match(health, /Website not found\./);
  assert.match(health, /Sign-in required\./);
  assert.doesNotMatch(health, /error: "Site introuvable\."/);
  assert.doesNotMatch(health, /error: "Connexion requise\."/);

  assert.doesNotMatch(tickets, /error: "Demande invalide\."/);
  assert.doesNotMatch(tickets, /error: "Tickets indisponibles\."/);
  assert.doesNotMatch(tickets, /error: "Ticket invalide\."/);
  assert.doesNotMatch(tickets, /error: "Ticket indisponible\."/);
  assert.doesNotMatch(tickets, /error: "Ticket introuvable\."/);
  assert.doesNotMatch(tickets, /error: "Nouveau diagnostic impossible\."/);
  assert.match(tickets, /Invalid request\./);
  assert.match(tickets, /Ticket not found\./);
});

test("domain media and export APIs do not leak raw English auth errors into French flows", () => {
  for (const path of [
    "app/api/domains/remove/route.ts",
    "app/api/domains/sync/route.ts",
    "app/api/media/promote/route.ts",
    "app/api/export/site/route.ts"
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /error:\s*"Unauthorized"/);
    assert.match(source, /Sign-in required\./);
  }

  const remove = read("app/api/domains/remove/route.ts");
  assert.doesNotMatch(remove, /error:"Domain unavailable"/);
  assert.match(remove, /Domaine indisponible\./);
  assert.match(remove, /Domain unavailable\./);

  const exported = read("app/api/export/site/route.ts");
  assert.match(exported, /Téléchargement impossible/);
  assert.match(exported, /Download failed/);
});
