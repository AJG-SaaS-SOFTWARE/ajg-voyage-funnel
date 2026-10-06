import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

type BetaGrant = {
  user_id: string;
  active: boolean;
  starts_at: string;
  expires_at: string;
};

export type BetaOperationsAgentResult = {
  ok: boolean;
  scannedUsers: number;
  grantCount: number;
  activeTesterCount: number;
  repairedMetadata: number;
  revokedStaleMetadata: number;
  repairFailures: number;
  followUpCandidates: number;
  awaitingResume: number;
  unresponsiveAfterFollowUp: number;
  completedMissions: number;
  errors: string[];
};

type MissionNextAction =
  | "essential"
  | "publish"
  | "compare"
  | "growth_explore"
  | "feedback"
  | "complete";

function activeGrant(grant: BetaGrant | undefined, now: number) {
  if (!grant?.active) return false;
  const start = Date.parse(grant.starts_at);
  const end = Date.parse(grant.expires_at);
  return Number.isFinite(start) && Number.isFinite(end) && start <= now && end > now;
}

function invitedAt(user: User) {
  const metadata = user.app_metadata?.beta_invited_at;
  return typeof metadata === "string" ? metadata : user.created_at;
}

function latestTimestamp(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) || null;
}

function missionNextAction(input: {
  events: Array<{ site_id: string | null; event_name: string; created_at: string }>;
  feedback: Array<{ site_id: string | null; created_at: string }>;
  primarySiteId: string | null;
  published: boolean;
}): MissionNextAction {
  const essential = input.events.filter((event) => event.event_name === "beta_essential_selected");
  const growth = input.events.filter((event) => event.event_name === "beta_growth_selected");
  const essentialThenGrowth = essential.some((essentialEvent) => {
    const essentialAt = Date.parse(essentialEvent.created_at);
    return Number.isFinite(essentialAt) && growth.some((growthEvent) => {
      const growthAt = Date.parse(growthEvent.created_at);
      return Number.isFinite(growthAt) && growthAt >= essentialAt;
    });
  });
  const matchesSite = (siteId: string | null) =>
    !input.primarySiteId || siteId === input.primarySiteId;
  const growthOpened = input.events.some(
    (event) => event.event_name === "beta_growth_cockpit_opened" && matchesSite(event.site_id)
  );
  const analyticsOpened = input.events.some(
    (event) => event.event_name === "beta_analytics_opened" && matchesSite(event.site_id)
  );
  const feedbackSent = input.feedback.some(
    (item) => !input.primarySiteId || item.site_id === input.primarySiteId || item.site_id === null
  );

  if (!essential.length) return "essential";
  if (!input.published) return "publish";
  if (!essentialThenGrowth) return "compare";
  if (!(growthOpened && analyticsOpened)) return "growth_explore";
  if (!feedbackSent) return "feedback";
  return "complete";
}

function isDueAfter(hours: number, timestamp: string | null, now: number) {
  if (!timestamp) return false;
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) && (now - parsed) / 3_600_000 >= hours;
}

async function listAllUsers(service: SupabaseClient) {
  const users: User[] = [];
  let page = 1;
  while (true) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...(data.users || []));
    if (!data.users?.length || data.users.length < 1000) break;
    page++;
  }
  return users;
}

async function executeBetaOperationsAgent(
  service: SupabaseClient,
  now = Date.now()
): Promise<BetaOperationsAgentResult> {
  const errors: string[] = [];
  let repairedMetadata = 0;
  let revokedStaleMetadata = 0;
  let repairFailures = 0;

  const [users, grantsResult] = await Promise.all([
    listAllUsers(service),
    service.from("beta_access_grants").select("user_id,active,starts_at,expires_at")
  ]);
  if (grantsResult.error) throw grantsResult.error;

  const grants = (grantsResult.data || []) as BetaGrant[];
  const grantsByUser = new Map(grants.map((grant) => [grant.user_id, grant]));
  const activeUserIds = new Set(
    grants.filter((grant) => activeGrant(grant, now)).map((grant) => grant.user_id)
  );

  for (const user of users) {
    const grant = grantsByUser.get(user.id);
    const shouldBeBeta = activeGrant(grant, now);
    const metadataBeta = user.app_metadata?.ajg_beta === true;
    if (metadataBeta === shouldBeBeta) continue;

    try {
      const appMetadata = { ...(user.app_metadata || {}) };
      if (shouldBeBeta && grant) {
        appMetadata.ajg_beta = true;
        appMetadata.beta_access_expires_at = grant.expires_at;
        appMetadata.beta_source =
          typeof appMetadata.beta_source === "string" ? appMetadata.beta_source : "grant_reconcile";
        if (typeof appMetadata.beta_invited_at !== "string") {
          appMetadata.beta_invited_at = user.created_at;
        }
        repairedMetadata++;
      } else {
        appMetadata.ajg_beta = false;
        delete appMetadata.beta_access_expires_at;
        revokedStaleMetadata++;
      }

      const { error } = await service.auth.admin.updateUserById(user.id, {
        app_metadata: appMetadata
      });
      if (error) throw error;
    } catch (error) {
      repairFailures++;
      errors.push(
        `metadata_reconcile:${user.id}:${error instanceof Error ? error.message : "unknown"}`
      );
    }
  }

  const betaUsers = users.filter((user) => activeUserIds.has(user.id));
  const userIds = betaUsers.map((user) => user.id);

  if (!userIds.length) {
    return {
      ok: repairFailures === 0,
      scannedUsers: users.length,
      grantCount: grants.length,
      activeTesterCount: 0,
      repairedMetadata,
      revokedStaleMetadata,
      repairFailures,
      followUpCandidates: 0,
      awaitingResume: 0,
      unresponsiveAfterFollowUp: 0,
      completedMissions: 0,
      errors
    };
  }

  const [sitesResult, eventsResult, feedbackResult, followupsResult] = await Promise.all([
    service
      .from("sites")
      .select("id,owner_id,status,published_at,updated_at")
      .in("owner_id", userIds)
      .order("updated_at", { ascending: false }),
    service
      .from("product_events")
      .select("user_id,site_id,event_name,created_at")
      .in("user_id", userIds)
      .gte("created_at", new Date(now - 120 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false }),
    service
      .from("user_feedback")
      .select("user_id,site_id,created_at")
      .in("user_id", userIds)
      .gte("created_at", new Date(now - 120 * 24 * 60 * 60 * 1000).toISOString()),
    service
      .from("beta_followups")
      .select("user_id,mission_next_action,sent_at")
      .in("user_id", userIds)
      .order("sent_at", { ascending: false })
  ]);

  const queryError =
    sitesResult.error || eventsResult.error || feedbackResult.error || followupsResult.error;
  if (queryError) throw queryError;

  let followUpCandidates = 0;
  let awaitingResume = 0;
  let unresponsiveAfterFollowUp = 0;
  let completedMissions = 0;

  for (const user of betaUsers) {
    const sites = (sitesResult.data || []).filter((site) => site.owner_id === user.id);
    const primary = sites[0] || null;
    const events = (eventsResult.data || []).filter((event) => event.user_id === user.id);
    const feedback = (feedbackResult.data || []).filter((item) => item.user_id === user.id);
    const followups = (followupsResult.data || []).filter((item) => item.user_id === user.id);
    const latestFollowUp = followups[0] || null;
    const published = Boolean(
      sites.some((site) => site.status === "published" || site.published_at) ||
      events.some(
        (event) =>
          event.event_name === "publish_success" &&
          (!primary?.id || event.site_id === primary.id)
      )
    );

    const nextAction = missionNextAction({
      events,
      feedback,
      primarySiteId: primary?.id || null,
      published
    });
    if (nextAction === "complete") {
      completedMissions++;
      continue;
    }

    const lastActivityAt = latestTimestamp([
      user.last_sign_in_at || null,
      ...sites.map((site) => site.updated_at),
      ...events.map((event) => event.created_at),
      ...feedback.map((item) => item.created_at)
    ]);
    const latestSentAt = latestFollowUp?.sent_at || null;
    const activityAt = lastActivityAt ? Date.parse(lastActivityAt) : NaN;
    const followUpAt = latestSentAt ? Date.parse(latestSentAt) : NaN;
    const resumed =
      Number.isFinite(activityAt) &&
      Number.isFinite(followUpAt) &&
      activityAt > followUpAt;

    if (latestSentAt && !resumed && !isDueAfter(72, latestSentAt, now)) {
      awaitingResume++;
      continue;
    }
    if (latestSentAt && !resumed && isDueAfter(72, latestSentAt, now)) {
      unresponsiveAfterFollowUp++;
      followUpCandidates++;
      continue;
    }

    if (!user.last_sign_in_at) {
      if (isDueAfter(48, invitedAt(user), now)) followUpCandidates++;
      continue;
    }

    if (isDueAfter(72, lastActivityAt, now)) followUpCandidates++;
  }

  return {
    ok: repairFailures === 0,
    scannedUsers: users.length,
    grantCount: grants.length,
    activeTesterCount: betaUsers.length,
    repairedMetadata,
    revokedStaleMetadata,
    repairFailures,
    followUpCandidates,
    awaitingResume,
    unresponsiveAfterFollowUp,
    completedMissions,
    errors
  };
}


function runStatus(result: BetaOperationsAgentResult): "healthy" | "attention" | "failed" {
  if (!result.ok || result.repairFailures > 0 || result.errors.length > 0) return "failed";
  if (result.followUpCandidates > 0 || result.unresponsiveAfterFollowUp > 0) return "attention";
  return "healthy";
}

export async function runBetaOperationsAgent(
  service: SupabaseClient,
  now = Date.now()
) {
  const startedAt = new Date(now).toISOString();
  const { data: journal, error: journalError } = await service
    .from("beta_operations_runs")
    .insert({ started_at: startedAt, status: "running" })
    .select("id")
    .single();
  if (journalError || !journal) {
    throw journalError || new Error("beta_agent_journal_unavailable");
  }

  try {
    const result = await executeBetaOperationsAgent(service, now);
    const completedAt = new Date().toISOString();
    const status = runStatus(result);
    const { error: updateError } = await service
      .from("beta_operations_runs")
      .update({
        completed_at: completedAt,
        status,
        scanned_users: result.scannedUsers,
        grant_count: result.grantCount,
        active_tester_count: result.activeTesterCount,
        repaired_metadata: result.repairedMetadata,
        revoked_stale_metadata: result.revokedStaleMetadata,
        repair_failures: result.repairFailures,
        follow_up_candidates: result.followUpCandidates,
        awaiting_resume: result.awaitingResume,
        unresponsive_after_followup: result.unresponsiveAfterFollowUp,
        completed_missions: result.completedMissions,
        errors: result.errors
      })
      .eq("id", journal.id);
    if (updateError) throw updateError;

    return {
      ...result,
      runId: journal.id as number,
      runStatus: status,
      startedAt,
      completedAt
    };
  } catch (error) {
    const completedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : "unknown";
    await service
      .from("beta_operations_runs")
      .update({
        completed_at: completedAt,
        status: "failed",
        errors: [message]
      })
      .eq("id", journal.id);
    throw error;
  }
}

export async function runBetaOperationsAgentFromEnvironment() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return {
      ok: false,
      scannedUsers: 0,
      grantCount: 0,
      activeTesterCount: 0,
      repairedMetadata: 0,
      revokedStaleMetadata: 0,
      repairFailures: 0,
      followUpCandidates: 0,
      awaitingResume: 0,
      unresponsiveAfterFollowUp: 0,
      completedMissions: 0,
      errors: ["supabase_not_configured"],
      runId: null,
      runStatus: "failed" as const,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    };
  }

  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return runBetaOperationsAgent(service);
}
