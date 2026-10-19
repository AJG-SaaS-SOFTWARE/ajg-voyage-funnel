import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function verifyDeployedCrons(project, manifest, projectId, teamId) {
  const fail = () => { throw new Error("production_cron_configuration_unconfirmed"); };
  const paidRecipe = path => {
    try { return new URL(path, "https://cron.example.invalid").pathname.replace(/\/+$/, "") === "/api/cron/release-e2e"; }
    catch { return true; }
  };
  if (typeof projectId !== "string" || !projectId.startsWith("prj_") ||
      typeof teamId !== "string" || !teamId.startsWith("team_") ||
      project?.id !== projectId || project.accountId !== teamId ||
      !Array.isArray(manifest?.crons) || !manifest.crons.length) fail();
  const live = project.crons;
  if (!live || !Number.isFinite(live.enabledAt) || live.enabledAt <= 0 ||
      (live.disabledAt != null && (!Number.isFinite(live.disabledAt) || live.disabledAt >= live.enabledAt)) ||
      typeof live.deploymentId !== "string" || !/^dpl_[A-Za-z0-9]+$/.test(live.deploymentId) ||
      !Array.isArray(live.definitions)) fail();
  const entries = rows => rows.map(row => {
    if (typeof row?.path !== "string" || !row.path.startsWith("/") || paidRecipe(row.path) ||
        typeof row.schedule !== "string" || !row.schedule.trim()) fail();
    return JSON.stringify([row.path, row.schedule.trim().replace(/\s+/g, " ")]);
  }).sort();
  const expected = entries(manifest.crons), actual = entries(live.definitions);
  if (!manifest.crons.some(row => row.path === "/api/cron/release-e2e-structural") ||
      JSON.stringify(actual) !== JSON.stringify(expected)) fail();
  // Vercel documents this as the deployment where definitions originated, so
  // record it without assuming unchanged definitions get a new ID every release.
  return { ok: true, projectId, schedulerDeploymentId: live.deploymentId,
    cronCount: actual.length, paidAiScheduled: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [projectFile, manifestFile, projectId, teamId] = process.argv.slice(2);
    const result = verifyDeployedCrons(JSON.parse(readFileSync(projectFile, "utf8")),
      JSON.parse(readFileSync(manifestFile, "utf8")), projectId, teamId);
    console.log(JSON.stringify(result));
  } catch {
    // Never print project metadata, environment values or raw provider errors.
    console.error("Production cron configuration is incomplete or differs from the reviewed manifest.");
    process.exitCode = 1;
  }
}
