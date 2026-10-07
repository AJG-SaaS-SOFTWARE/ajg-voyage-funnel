import { spawn } from "node:child_process";

const port = Number(process.env.SMOKE_PORT || 3107);
const origin = `http://localhost:${port}`;
let stdout = "";
let stderr = "";

const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", String(port), "--hostname", "127.0.0.1"],
  {
    env: { ...process.env, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"]
  }
);

child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

async function waitUntilReady() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`next start exited early with code ${child.exitCode}\n${stdout}\n${stderr}`);
    }
    try {
      const response = await fetch(origin + "/login", { redirect: "manual", signal: AbortSignal.timeout(1500) });
      if (response.status < 500) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error(`next start did not become ready\n${stdout}\n${stderr}`);
}

async function expectStatus(path, expected, init = {}) {
  console.log("Smoke:", init.method || "GET", path);
  const response = await fetch(origin + path, {
    ...init,
    redirect: "manual",
    signal: AbortSignal.timeout(8000)
  });
  if (response.status !== expected) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `${path}: expected HTTP ${expected}, got ${response.status}\n${body.slice(0, 1000)}`
    );
  }
}


async function expectLocalizedHtml(path, locale, expectedText, forbiddenText) {
  console.log("Smoke locale:", locale, path);
  const response = await fetch(origin + path, {
    redirect: "manual",
    headers: {
      cookie: `ajg_builder_language=${locale}`,
      "accept-language": locale === "en" ? "en-GB,en;q=0.9" : "fr-FR,fr;q=0.9"
    },
    signal: AbortSignal.timeout(8000)
  });
  if (response.status !== 200) {
    throw new Error(`${path} (${locale}): expected HTTP 200, got ${response.status}`);
  }

  const html = await response.text();
  if (!html.includes(`lang="${locale}"`)) {
    throw new Error(`${path} (${locale}): root html lang is not ${locale}`);
  }
  for (const text of expectedText) {
    if (!html.includes(text)) {
      throw new Error(`${path} (${locale}): missing expected text "${text}"`);
    }
  }
  for (const text of forbiddenText) {
    if (html.includes(text)) {
      throw new Error(`${path} (${locale}): unexpected opposite-locale text "${text}"`);
    }
  }
}

async function expectMirroredLocale(path, frExpected, enExpected) {
  await expectLocalizedHtml(path, "fr", frExpected, enExpected);
  await expectLocalizedHtml(path, "en", enExpected, frExpected);
}

try {
  await waitUntilReady();
  await expectStatus("/login", 200);
  await expectStatus("/plans", 200);
  await expectStatus("/tarifs", 200);
  await expectStatus("/pricing", 200);
  await expectStatus("/billing", 200);
  await expectMirroredLocale(
    "/login",
    ["Connexion", "Adresse email", "Recevoir mon lien de connexion"],
    ["Sign in", "Email address", "Send me a sign-in link"]
  );
  await expectMirroredLocale(
    "/plans",
    ["Mon offre", "Votre compte"],
    ["My plan", "Your account"]
  );
  await expectMirroredLocale(
    "/billing",
    ["Facturation", "Votre compte", "Votre accès ELTARA", "Facturation & récupération"],
    ["Billing", "Your account", "Your ELTARA access", "Billing & recovery"]
  );
  await expectMirroredLocale(
    "/domains",
    ["Domaines", "Votre compte", "Mettre votre domaine en ligne, étape par étape", "Domaine personnalisé"],
    ["Domains", "Your account", "Put your domain online, step by step", "Custom domain"]
  );
  await expectMirroredLocale(
    "/data",
    ["Mes données", "Votre compte", "Confidentialité & données", "Exportez vos données"],
    ["My data", "Your account", "Privacy & data", "Export your data"]
  );
  await expectLocalizedHtml(
    "/pricing",
    "en",
    ["Build. Run. Grow.", "Choose Essential", "Choose Growth"],
    ["Créez. Gérez. Faites progresser.", "Choisir Essentiel", "Choisir Growth"]
  );
  await expectLocalizedHtml(
    "/tarifs",
    "fr",
    ["Créez. Gérez. Faites progresser.", "Choisir Essentiel", "Choisir Growth"],
    ["Build. Run. Grow.", "Choose Essential", "Choose Growth"]
  );
  await expectMirroredLocale(
    "/builder",
    ["Chargement de votre espace…", "Aperçu", "Mon offre", "Mes données"],
    ["Loading your workspace…", "Preview", "My plan", "My data"]
  );
  await expectMirroredLocale(
    "/growth",
    ["Piloter la santé de votre site", "Préparation du cockpit Growth…", "Disponibilité & accès"],
    ["Manage your website health", "Preparing the Growth cockpit…", "Availability & access"]
  );
  await expectMirroredLocale(
    "/analytics",
    ["Comprenez ce qui se passe sur votre site", "Chargement des analytics…", "Période d’analyse"],
    ["Understand what happens on your website", "Loading analytics…", "Analytics period"]
  );
  await expectMirroredLocale(
    "/support",
    ["Aide et demandes", "Diagnostic en cours…", "Nouvelle demande"],
    ["Help and requests", "Running diagnosis…", "New request"]
  );
  await expectMirroredLocale(
    "/messages",
    ["Messages reçus", "Chargement des messages…", "Aucun message"],
    ["Received messages", "Loading messages…", "No messages"]
  );
  await expectStatus("/ci-route-that-does-not-exist", 404);
  await expectStatus("/api/export/site?siteId=ci&format=archive", 401);
  await expectStatus("/api/admin/release-readiness", 401);
  await expectStatus("/api/admin/beta-metrics", 401);
  await expectStatus("/api/admin/ai-finops", 401);
  await expectStatus("/api/admin/beta-cohort", 401);
  await expectStatus("/api/admin/beta-cohort", 401, { method: "POST" });
  await expectStatus("/api/admin/beta-followups", 401, { method: "POST" });
  await expectStatus("/api/admin/beta-operations", 401);
  await expectStatus("/api/admin/beta-operations", 401, { method: "POST" });
  await expectStatus("/api/admin/managed-domains", 401);
  await expectStatus("/api/admin/managed-domains", 401, { method: "POST" });
  await expectStatus("/api/admin/storage-bootstrap", 401, { method: "POST" });
  await expectStatus("/api/cron/beta-operations", 401);
  await expectStatus("/api/cron/support-operations", 401);
  await expectStatus("/api/admin/support-operations", 401);
  await expectStatus("/api/admin/support-operations", 401, { method: "POST" });
  console.log("ELTARA release smoke passed.");
} finally {
  child.kill("SIGTERM");
  await new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    const forceTimer = setTimeout(() => {
      if (child.exitCode === null) child.kill("SIGKILL");
    }, 1500);
    child.once("exit", () => {
      clearTimeout(forceTimer);
      resolve();
    });
  });
}
