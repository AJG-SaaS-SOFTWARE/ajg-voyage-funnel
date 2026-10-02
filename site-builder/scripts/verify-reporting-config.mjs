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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.argv[2]) throw new Error("missing_configuration_file");
    const result = verifyReportingFile(process.argv[2], process.argv[3]);
    console.log("Cockpit reporting configuration: " + result.status);
  } catch {
    console.error("Cockpit reporting configuration preflight failed; publication blocked.");
    process.exitCode = 1;
  }
}

