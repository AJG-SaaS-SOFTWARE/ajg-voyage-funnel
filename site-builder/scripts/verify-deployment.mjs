const args = process.argv.slice(2);
const baseUrl = args.find((arg) => arg.startsWith("--url="))?.slice(6)?.replace(/\/$/, "");
const expectedSha = args.find((arg) => arg.startsWith("--sha="))?.slice(6) || process.env.EXPECTED_SHA || "";
const allowUnknownSha = args.includes("--allow-unknown-sha");

if (!baseUrl) {
  console.error("Usage: node scripts/verify-deployment.mjs --url=https://... [--sha=<commit>] [--allow-unknown-sha]");
  process.exit(2);
}

async function get(path, expected) {
  const response = await fetch(baseUrl + path, {
    redirect: "manual",
    signal: AbortSignal.timeout(10000)
  });
  if (!expected.includes(response.status)) {
    const body = await response.text().catch(() => "");
    throw new Error(`${path}: expected ${expected.join("/")}, got ${response.status}\n${body.slice(0, 1200)}`);
  }
  return response;
}

const health = await get("/api/health", [200]);
const payload = await health.json();
if (!payload?.ok || payload?.database !== "ok") {
  throw new Error("Health check did not report a ready database.");
}

const deployedSha = payload?.deployment?.commitSha || "";
if (expectedSha) {
  if (!deployedSha && !allowUnknownSha) {
    throw new Error("Deployment SHA is unavailable; cannot prove that the requested release is deployed.");
  }
  if (deployedSha && !deployedSha.startsWith(expectedSha) && !expectedSha.startsWith(deployedSha)) {
    throw new Error(`Wrong deployment revision: expected ${expectedSha}, got ${deployedSha}`);
  }
}

await get("/login", [200]);
await get("/plans", [200]);
await get("/billing", [200]);
await get("/ci-route-that-does-not-exist", [404]);
await get("/api/export/site?siteId=ci&format=archive", [401]);
await get("/api/admin/release-readiness", [401]);
await get("/api/admin/beta-metrics", [401]);
await get("/api/admin/beta-cohort", [401]);
await get("/api/admin/managed-domains", [401]);

console.log(JSON.stringify({
  ok: true,
  url: baseUrl,
  environment: payload.environment,
  commitSha: deployedSha || null,
  region: payload.region,
  checkedAt: payload.checkedAt
}, null, 2));
