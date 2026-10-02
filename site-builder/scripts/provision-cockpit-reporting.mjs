import { randomBytes, timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";

const team = "team_T1xBMzY6HJCAkUStrmkUgj60";
const targets = [
  { project: "prj_RUtVL1fXzOqY8dHetb6U2dp07Ygn", key: "AJG_COCKPIT_REPORTING_TOKEN" },
  { project: "prj_fCCgbFY2qK6JoFfr9afmIw9BbshG", key: "AJG_BUILDER_COCKPIT_REPORTING_TOKEN" },
];

export function selectSharedToken(values, generate = () => randomBytes(32).toString("hex")) {
  const existing = values.filter(value => value !== null);
  if (existing.some(value => typeof value !== "string" || value !== value.trim() || value.length < 32)) {
    throw new Error("reporting_existing_token_invalid");
  }
  if (existing.length > 1) {
    const left = Buffer.from(existing[0]); const right = Buffer.from(existing[1]);
    if (left.length !== right.length || !timingSafeEqual(left, right)) throw new Error("reporting_token_conflict");
  }
  return existing[0] ?? generate();
}

export async function provisionReporting(accessToken, request = fetch) {
  if (!accessToken) throw new Error("provider_access_missing");
  async function api(path, body) {
    const url = new URL("https://api.vercel.com" + path); url.searchParams.set("teamId", team);
    const response = await request(url, {
      method: body ? "POST" : "GET", redirect: "error", signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error("provider_access_failed_" + response.status + (path.includes(targets[0].project) ? "_builder" : "_cockpit"));
    return response.json();
  }
  async function read(target) {
    const payload = await api(`/v10/projects/${target.project}/env?decrypt=false`);
    const rows = Array.isArray(payload) ? payload : payload.envs || payload.data;
    if (!Array.isArray(rows)) throw new Error("provider_metadata_invalid");
    const matches = rows.filter(row => row.key === target.key && Array.isArray(row.target) && row.target.includes("production"));
    if (matches.length > 1) throw new Error("reporting_token_conflict");
    if (!matches.length) return null;
    if (!matches[0].id) throw new Error("provider_metadata_invalid");
    const row = await api(`/v1/projects/${target.project}/env/${encodeURIComponent(matches[0].id)}`);
    if (row.key !== target.key || row.decrypted !== true || typeof row.value !== "string") throw new Error("reporting_existing_token_unreadable");
    return row.value;
  }
  // Read both sides before mutation. Never update, rotate or delete an existing credential.
  const values = await Promise.all(targets.map(read));
  const shared = selectSharedToken(values);
  for (let index = 0; index < targets.length; index++) {
    if (values[index] !== null) continue;
    const target = targets[index];
    const result = await api(`/v10/projects/${target.project}/env`, {
      key: target.key, value: shared, type: "encrypted", target: ["production"],
      comment: "WOR-185 private Builder reporting; server only",
    });
    if (result.failed?.length) throw new Error("provider_create_failed");
  }
  const confirmed = await Promise.all(targets.map(read));
  if (confirmed.some(value => value !== shared)) throw new Error("reporting_token_verification_failed");
  return { configured: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await provisionReporting(process.env.VERCEL_TOKEN);
    console.log("Builder/Cockpit private reporting credential configured and matched. Redeployment required.");
  } catch (error) {
    const code = error instanceof Error && /^(provider_access_missing|provider_access_failed_[0-9]{3}_(builder|cockpit)|provider_metadata_invalid|reporting_token_conflict|reporting_existing_token_invalid|reporting_existing_token_unreadable|provider_create_failed|reporting_token_verification_failed)$/.test(error.message) ? error.message : "provider_transport_or_response_failed";
    console.error("Private reporting provisioning failure category: " + code);
    console.error("Private reporting provisioning failed; no existing credential was rotated. Check provider access and configuration.");
    process.exitCode = 1;
  }
}
