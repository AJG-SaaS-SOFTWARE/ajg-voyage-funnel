import { spawn } from "node:child_process";

const port = Number(process.env.SMOKE_PORT || 3107);
const origin = `http://127.0.0.1:${port}`;
let stdout = "";
let stderr = "";

const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", String(port)],
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
      const response = await fetch(origin + "/login", { redirect: "manual" });
      if (response.status < 500) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error(`next start did not become ready\n${stdout}\n${stderr}`);
}

async function expectStatus(path, expected) {
  const response = await fetch(origin + path, { redirect: "manual" });
  if (response.status !== expected) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `${path}: expected HTTP ${expected}, got ${response.status}\n${body.slice(0, 1000)}`
    );
  }
}

try {
  await waitUntilReady();
  await expectStatus("/login", 200);
  await expectStatus("/plans", 200);
  await expectStatus("/billing", 200);
  await expectStatus("/ci-route-that-does-not-exist", 404);
  await expectStatus("/api/export/site?siteId=ci&format=archive", 401);
  console.log("AJG Builder release smoke passed.");
} finally {
  child.kill("SIGTERM");
  await new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    const timer = setTimeout(resolve, 3000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
