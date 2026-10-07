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

async function getPublicRoute(path) {
  const response = await get(path, [200, 307, 308]);
  if (response.status === 200) return response;

  const location = response.headers.get("location") || "";
  let redirected;
  try {
    redirected = new URL(location, baseUrl);
  } catch {
    throw new Error(`${path}: invalid canonical redirect location`);
  }

  if (redirected.hostname !== "eltara.ajgsolutionsgroup.com") {
    throw new Error(
      `${path}: unexpected canonical redirect host ${redirected.hostname || "unknown"}`,
    );
  }
  if (redirected.pathname !== path) {
    throw new Error(
      `${path}: unexpected canonical redirect path ${redirected.pathname}`,
    );
  }
  return response;
}

async function getCanonicalPage(path) {
  const response = await getPublicRoute(path);
  if (response.status === 200) return response;

  const canonicalUrl = new URL(path, "https://eltara.ajgsolutionsgroup.com");
  const canonical = await fetch(canonicalUrl, {
    redirect: "manual",
    signal: AbortSignal.timeout(10000)
  });
  if (canonical.status !== 200) {
    const body = await canonical.text().catch(() => "");
    throw new Error(
      `${path}: canonical ELTARA page expected 200, got ${canonical.status}\n${body.slice(0, 1200)}`
    );
  }
  return canonical;
}

async function verifyLocalizedPage(path, {
  locale,
  htmlLang,
  title,
  legalHref
}) {
  const response = await getCanonicalPage(path);
  const contentLanguage = (response.headers.get("content-language") || "").toLowerCase();
  if (contentLanguage !== locale) {
    throw new Error(
      `${path}: expected Content-Language ${locale}, got ${contentLanguage || "missing"}`
    );
  }

  const body = await response.text();
  if (!body.includes(`<html lang="${htmlLang}"`)) {
    throw new Error(`${path}: expected html lang ${htmlLang}`);
  }
  if (!body.includes(title)) {
    throw new Error(`${path}: expected localized title ${title}`);
  }
  if (!body.includes(`href="${legalHref}"`)) {
    throw new Error(`${path}: expected localized legal link ${legalHref}`);
  }
}

async function verifyLocalizedNotFound(locale, expectedText) {
  const path = "/ci-page-that-does-not-exist";
  const headers = {
    "Accept-Language": locale === "en" ? "en-GB,en;q=0.9" : "fr-FR,fr;q=0.9"
  };
  let response = await fetch(baseUrl + path, {
    redirect: "manual",
    headers,
    signal: AbortSignal.timeout(10000)
  });

  if (response.status === 307 || response.status === 308) {
    const location = response.headers.get("location") || "";
    let redirected;
    try {
      redirected = new URL(location, baseUrl);
    } catch {
      throw new Error(`404 page: invalid canonical redirect for ${locale}`);
    }
    if (
      redirected.hostname !== "eltara.ajgsolutionsgroup.com" ||
      redirected.pathname !== path
    ) {
      throw new Error(
        `404 page: unexpected canonical redirect for ${locale}: ${redirected.href}`
      );
    }
    response = await fetch(redirected, {
      redirect: "manual",
      headers,
      signal: AbortSignal.timeout(10000)
    });
  }

  if (response.status !== 404) {
    throw new Error(`404 page: expected 404 for ${locale}, got ${response.status}`);
  }

  const body = await response.text();
  if (!body.includes(`<html lang="${locale}"`)) {
    throw new Error(`404 page: expected html lang ${locale}`);
  }
  if (!body.includes(expectedText)) {
    throw new Error(`404 page: expected localized copy ${expectedText}`);
  }
  if (locale === "fr" && body.includes("This page could not be found.")) {
    throw new Error("404 page: native English Next.js fallback leaked into French rendering");
  }
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

await getPublicRoute("/login");
await getPublicRoute("/plans");
await getPublicRoute("/billing");
await verifyLocalizedPage("/tarifs", {
  locale: "fr",
  htmlLang: "fr",
  title: "Créez. Gérez. Faites progresser.",
  legalHref: "/mentions-legales"
});
await verifyLocalizedPage("/pricing", {
  locale: "en",
  htmlLang: "en",
  title: "Build. Run. Grow.",
  legalHref: "/legal"
});
await verifyLocalizedNotFound("fr", "Page introuvable");
await verifyLocalizedNotFound("en", "Page not found");
await get("/api/ci-route-that-does-not-exist", [404]);
await get("/api/export/site?siteId=ci&format=archive", [401]);
await get("/api/admin/release-readiness", [401]);
await get("/api/admin/beta-metrics", [401]);
await get("/api/admin/ai-finops", [401]);
await get("/api/admin/beta-cohort", [401]);
await get("/api/admin/beta-followups", [405]);
await get("/api/admin/managed-domains", [401]);

console.log(JSON.stringify({
  ok: true,
  url: baseUrl,
  environment: payload.environment,
  commitSha: deployedSha || null,
  region: payload.region,
  checkedAt: payload.checkedAt
}, null, 2));
