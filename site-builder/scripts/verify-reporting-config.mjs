import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { pathToFileURL } from "node:url";

export function validateReportingConfiguration(configuration) {
  const raw = configuration.AJG_COCKPIT_REPORTING_TOKEN;
  if (raw === undefined || raw === "") return { status: "disabled" };
  if (typeof raw !== "string" || raw.trim().length < 32) {
    throw new Error("reporting_token_configuration_invalid");
  }
  return { status: "ready" };
}

export function verifyReportingFile(path, metadataPath) {
  try {
    const configuration = parseEnv(readFileSync(path, "utf8"));
    if (metadataPath) {
      const payload = JSON.parse(readFileSync(metadataPath, "utf8"));
      const rows = Array.isArray(payload) ? payload : payload.envs || payload.data;
      if (!Array.isArray(rows)) throw new Error("invalid_metadata");
      const configured = rows.some(row => row.key === "AJG_COCKPIT_REPORTING_TOKEN" &&
        Array.isArray(row.target) && row.target.includes("production"));
      if (configured && !configuration.AJG_COCKPIT_REPORTING_TOKEN) {
        throw new Error("configured_token_unreadable");
      }
    }
    return validateReportingConfiguration(configuration);
  } catch {
    // Never include file content, secret values or provider errors.
    throw new Error("reporting_configuration_preflight_failed");
  }
}

export async function verifyReportingProvider(metadataPath, environment = process.env, request = fetch) {
  try {
    const payload = JSON.parse(readFileSync(metadataPath, "utf8"));
    const rows = Array.isArray(payload) ? payload : payload.envs || payload.data;
    if (!Array.isArray(rows)) throw new Error("invalid_metadata");
    const matches = rows.filter(row => row.key === "AJG_COCKPIT_REPORTING_TOKEN" &&
      Array.isArray(row.target) && row.target.includes("production"));
    if (!matches.length) return { status: "disabled" };
    if (matches.length !== 1 || !matches[0].id || !environment.VERCEL_TOKEN ||
        !environment.VERCEL_PROJECT_ID || !environment.VERCEL_ORG_ID) throw new Error("invalid_provider_configuration");
    const url = new URL("https://api.vercel.com/v1/projects/" +
      encodeURIComponent(environment.VERCEL_PROJECT_ID) + "/env/" + encodeURIComponent(matches[0].id));
    url.searchParams.set("teamId", environment.VERCEL_ORG_ID);
    url.searchParams.set("decrypt", "true");
    const response = await request(url, {
      headers: { Authorization: "Bearer " + environment.VERCEL_TOKEN },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("provider_request_failed");
    const row = await response.json();
    if (row.key !== "AJG_COCKPIT_REPORTING_TOKEN" || row.decrypted !== true ||
        typeof row.value !== "string" || !row.value) throw new Error("configured_token_unreadable");
    return validateReportingConfiguration({ AJG_COCKPIT_REPORTING_TOKEN: row.value });
  } catch {
    throw new Error("reporting_configuration_preflight_failed");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.argv[2]) throw new Error("missing_configuration_file");
    const result = process.argv[2] === "--provider"
      ? await verifyReportingProvider(process.argv[3])
      : verifyReportingFile(process.argv[2], process.argv[3]);
    console.log("Cockpit reporting configuration: " + result.status);
  } catch {
    console.error("Cockpit reporting configuration preflight failed; publication blocked.");
    process.exitCode = 1;
  }
}
