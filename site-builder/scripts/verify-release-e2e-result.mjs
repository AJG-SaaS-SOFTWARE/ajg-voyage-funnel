import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function validateReleaseE2EResult(payload, sha, mode) {
  const fail = () => { throw new Error("release_e2e_evidence_unconfirmed"); };
  if (!/^[a-f0-9]{40}$/.test(sha || "") || !["structural", "full"].includes(mode)) fail();
  if (!payload || payload.ok !== true || payload.sha !== sha || payload.mode !== mode ||
      payload.includeAi !== (mode === "full") || payload.blocked === true ||
      !Array.isArray(payload.plans) || payload.plans.length !== 2) fail();

  const pending = [];
  for (const locale of ["fr", "en"]) {
    const matches = payload.plans.filter(plan => plan?.locale === locale);
    if (matches.length !== 1) fail();
    const plan = matches[0];
    if (plan.run === true && plan.reason === "missing_validation") pending.push(locale);
    else if (!(plan.run === false && plan.reason === "already_validated")) fail();
  }

  if (!pending.length) {
    // Only journal-backed already_validated skips are evidence. Cooldown and
    // retry_budget_exhausted must never turn an HTTP 200 into a green release.
    if (payload.executed !== false || (payload.results !== undefined &&
        (!Array.isArray(payload.results) || payload.results.length !== 0)) ||
        payload.cleanupOk === false) fail();
    return;
  }
  if (payload.executed !== true || payload.cleanupOk !== true ||
      !Array.isArray(payload.results) || payload.results.length !== pending.length) fail();
  for (const locale of pending) {
    const matches = payload.results.filter(result => result?.locale === locale);
    if (matches.length !== 1 || matches[0].ok !== true ||
        !Number.isInteger(matches[0].status) || matches[0].status < 200 || matches[0].status >= 300) fail();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [file, sha, mode] = process.argv.slice(2);
    validateReleaseE2EResult(JSON.parse(readFileSync(file, "utf8")), sha, mode);
    console.log("FR/EN release E2E evidence validated for the expected deployment and mode.");
  } catch {
    // Response bodies can contain provider details. Emit fixed text only.
    console.error("FR/EN release E2E evidence is incomplete or inconsistent; validation failed.");
    process.exitCode = 1;
  }
}
