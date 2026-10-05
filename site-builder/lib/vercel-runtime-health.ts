type RuntimeLogRow = {
  level?: string;
  timestampInMs?: number;
  responseStatusCode?: number;
};

export type RuntimeHealth = {
  checked: boolean;
  deploymentId: string | null;
  lookbackMinutes: number;
  sampledLogs: number;
  errorCount: number;
  fatalCount: number;
  http5xxCount: number;
  truncated: boolean;
  status: "healthy" | "warning" | "incident" | "unknown";
};

const MAX_BYTES = 128 * 1024;
const MAX_ROWS = 500;
const TIMEOUT_MS = 3500;
const LOOKBACK_MINUTES = 60;

export function summarizeRuntimeRows(
  rows: RuntimeLogRow[],
  nowMs = Date.now(),
  truncated = false,
  deploymentId: string | null = null
): RuntimeHealth {
  const cutoff = nowMs - LOOKBACK_MINUTES * 60_000;
  const recent = rows.filter((row) => {
    const ts = Number(row.timestampInMs);
    return Number.isFinite(ts) && ts >= cutoff && ts <= nowMs + 60_000;
  });
  const fatalCount = recent.filter((row) => String(row.level || "").toLowerCase() === "fatal").length;
  const errorCount = recent.filter((row) => {
    const level = String(row.level || "").toLowerCase();
    return level === "error" || level === "fatal";
  }).length;
  const http5xxCount = recent.filter((row) => {
    const status = Number(row.responseStatusCode);
    return Number.isInteger(status) && status >= 500 && status <= 599;
  }).length;
  const incident = fatalCount > 0 || errorCount >= 5 || http5xxCount >= 5;
  const warning = errorCount > 0 || http5xxCount > 0;
  return {
    checked: true,
    deploymentId,
    lookbackMinutes: LOOKBACK_MINUTES,
    sampledLogs: recent.length,
    errorCount,
    fatalCount,
    http5xxCount,
    truncated,
    status: incident ? "incident" : warning ? "warning" : "healthy"
  };
}

function unknown(deploymentId: string | null = null): RuntimeHealth {
  return {
    checked: false,
    deploymentId,
    lookbackMinutes: LOOKBACK_MINUTES,
    sampledLogs: 0,
    errorCount: 0,
    fatalCount: 0,
    http5xxCount: 0,
    truncated: false,
    status: "unknown"
  };
}

async function latestProductionDeployment(token: string, projectId: string, teamId: string) {
  const systemDeployment = process.env.VERCEL_DEPLOYMENT_ID?.trim();
  if (systemDeployment?.startsWith("dpl_")) return systemDeployment;

  const query = new URLSearchParams({
    projectId,
    target: "production",
    state: "READY",
    limit: "1",
    teamId
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`https://api.vercel.com/v6/deployments?${query.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    });
    if (!response.ok) return null;
    const body = await response.json().catch(() => null);
    const item = Array.isArray(body?.deployments) ? body.deployments[0] : null;
    const id = item?.id || item?.uid;
    return typeof id === "string" && id.startsWith("dpl_") ? id : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function parseLine(line: string): RuntimeLogRow | null {
  const value = line.trim();
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed as RuntimeLogRow : null;
  } catch {
    return null;
  }
}

export async function getRecentRuntimeHealth(): Promise<RuntimeHealth> {
  const token = process.env.VERCEL_TOKEN?.trim() || "";
  const projectId = process.env.VERCEL_PROJECT_ID?.trim() || "";
  const teamId = process.env.VERCEL_TEAM_ID?.trim() || process.env.VERCEL_ORG_ID?.trim() || "";
  if (!token || !projectId || !teamId) return unknown();

  const deploymentId = await latestProductionDeployment(token, projectId, teamId);
  if (!deploymentId) return unknown();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const rows: RuntimeLogRow[] = [];
  let bytes = 0;
  let truncated = false;
  let pending = "";

  try {
    const response = await fetch(
      `https://api.vercel.com/v1/projects/${encodeURIComponent(projectId)}/deployments/${encodeURIComponent(deploymentId)}/runtime-logs?teamId=${encodeURIComponent(teamId)}`,
      {
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/x-ndjson, application/json"
        }
      }
    );
    if (!response.ok || !response.body) return unknown(deploymentId);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (rows.length < MAX_ROWS && bytes < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split("\n");
      pending = lines.pop() || "";
      for (const line of lines) {
        const row = parseLine(line);
        if (row) rows.push(row);
        if (rows.length >= MAX_ROWS) break;
      }
    }
    if (bytes >= MAX_BYTES || rows.length >= MAX_ROWS) {
      truncated = true;
      await reader.cancel().catch(() => undefined);
    } else if (pending.trim()) {
      const row = parseLine(pending);
      if (row) rows.push(row);
    }
    return summarizeRuntimeRows(rows, Date.now(), truncated, deploymentId);
  } catch {
    return rows.length
      ? summarizeRuntimeRows(rows, Date.now(), true, deploymentId)
      : unknown(deploymentId);
  } finally {
    clearTimeout(timeout);
  }
}
