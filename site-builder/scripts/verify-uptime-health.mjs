import { readFileSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function validateUptimeHealth(payload, httpStatus) {
  const sha = payload?.deployment?.commitSha;
  const deploymentId = payload?.deployment?.deploymentId;
  if (httpStatus !== "200" || payload?.ok !== true ||
      payload?.service !== "ajg-site-builder" || payload?.database !== "ok" ||
      payload?.environment !== "production" || typeof sha !== "string" ||
      !/^[a-f0-9]{40}$/.test(sha) || typeof deploymentId !== "string" ||
      !/^dpl_[A-Za-z0-9]+$/.test(deploymentId)) {
    throw Error("uptime_health_unconfirmed");
  }
  // Do not echo arbitrary response fields or compare app SHA to GitHub main:
  // a GitHub-only operational change need not redeploy the application.
  return { ok: true, service: "ajg-site-builder", environment: "production", commitSha: sha, deploymentId };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [file, status] = process.argv.slice(2);
    if (status !== "200" || statSync(file).size > 16 * 1024) throw Error();
    console.log(JSON.stringify(validateUptimeHealth(JSON.parse(readFileSync(file, "utf8")), status)));
  } catch {
    console.error("ELTARA uptime health evidence is unconfirmed; validation failed.");
    process.exitCode = 1;
  }
}
