import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearer(request: Request) {
  const value = request.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

function percent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function aggregateProviderUsage(rows: any[]) {
  const inputTokens = rows.reduce(
    (sum, item) => sum + (Number(item.input_tokens) || 0),
    0
  );
  const cachedInputTokens = rows.reduce(
    (sum, item) => sum + (Number(item.cached_input_tokens) || 0),
    0
  );
  const outputTokens = rows.reduce(
    (sum, item) => sum + (Number(item.output_tokens) || 0),
    0
  );
  const reasoningTokens = rows.reduce(
    (sum, item) => sum + (Number(item.reasoning_tokens) || 0),
    0
  );
  const totalTokens = rows.reduce(
    (sum, item) => sum + (Number(item.total_tokens) || 0),
    0
  );
  const durationMs = rows.reduce(
    (sum, item) => sum + (Number(item.duration_ms) || 0),
    0
  );

  const modelMap = new Map<
    string,
    {
      model: string;
      calls: number;
      inputTokens: number;
      cachedInputTokens: number;
      outputTokens: number;
      totalTokens: number;
    }
  >();
  const operationMap = new Map<string, { operation: string; calls: number; totalTokens: number }>();

  for (const row of rows) {
    const model = row.model || "unknown";
    const currentModel = modelMap.get(model) || {
      model,
      calls: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      totalTokens: 0
    };
    currentModel.calls += 1;
    currentModel.inputTokens += Number(row.input_tokens) || 0;
    currentModel.cachedInputTokens += Number(row.cached_input_tokens) || 0;
    currentModel.outputTokens += Number(row.output_tokens) || 0;
    currentModel.totalTokens += Number(row.total_tokens) || 0;
    modelMap.set(model, currentModel);

    const operation = row.operation || "unknown";
    const currentOperation = operationMap.get(operation) || {
      operation,
      calls: 0,
      totalTokens: 0
    };
    currentOperation.calls += 1;
    currentOperation.totalTokens += Number(row.total_tokens) || 0;
    operationMap.set(operation, currentOperation);
  }

  return {
    calls: rows.length,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningTokens,
    totalTokens,
    durationMs,
    avgTokensPerCall: rows.length > 0 ? Math.round(totalTokens / rows.length) : 0,
    avgDurationMsPerCall: rows.length > 0 ? Math.round(durationMs / rows.length) : 0,
    byModel: [...modelMap.values()].sort((a, b) => b.calls - a.calls),
    byOperation: [...operationMap.values()].sort((a, b) => b.calls - a.calls)
  };
}

export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !publishable || !serviceKey) {
    return NextResponse.json({ error: "Admin metrics unavailable" }, { status: 503 });
  }

  const token = bearer(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userClient = createClient(url, publishable, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser(token);
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: role, error: roleError } = await userClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (roleError || role?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: authUsers, error: authUsersError } =
    await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (authUsersError) {
    return NextResponse.json({ error: "Beta cohort unavailable" }, { status: 503 });
  }

  const betaUsers = (authUsers.users || []).filter(
    (user) => user.app_metadata?.ajg_beta === true
  );
  const betaUserIds = new Set(betaUsers.map((user) => user.id));
  const cohortScope = betaUserIds.size ? "beta" : "all";

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: events, error: eventsError },
    { data: aiUsage, error: aiError },
    { data: feedback, error: feedbackError },
    { data: sites, error: sitesError },
    { data: providerUsage, error: providerUsageError },
    { data: architectFeedback, error: architectFeedbackError }
  ] = await Promise.all([
    service
      .from("product_events")
      .select("event_name,user_id,site_id,created_at")
      .gte("created_at", since),
    service
      .from("ai_usage_events")
      .select("user_id,created_at")
      .gte("created_at", since),
    service
      .from("user_feedback")
      .select("user_id,site_id,rating,status,created_at")
      .gte("created_at", since),
    service
      .from("sites")
      .select("id,slug,owner_id,status,created_at,published_at,updated_at"),
    service
      .from("ai_provider_usage")
      .select("user_id,site_id,operation,model,input_tokens,cached_input_tokens,output_tokens,reasoning_tokens,total_tokens,duration_ms,created_at")
      .gte("created_at", since),
    service
      .from("architect_quality_feedback")
      .select("user_id,site_id,verdict,reason,attempt_kind,audit_score,refinement_applied,created_at")
      .gte("created_at", since)
  ]);

  if (
    eventsError ||
    aiError ||
    feedbackError ||
    sitesError ||
    providerUsageError ||
    architectFeedbackError
  ) {
    return NextResponse.json({ error: "Beta metrics unavailable" }, { status: 503 });
  }

  const eventRows =
    cohortScope === "beta"
      ? (events || []).filter((item) => typeof item.user_id === "string" && betaUserIds.has(item.user_id))
      : events || [];
  const feedbackRows =
    cohortScope === "beta"
      ? (feedback || []).filter((item) => typeof item.user_id === "string" && betaUserIds.has(item.user_id))
      : feedback || [];
  const aiRows =
    cohortScope === "beta"
      ? (aiUsage || []).filter((item) => typeof item.user_id === "string" && betaUserIds.has(item.user_id))
      : aiUsage || [];
  const siteRows =
    cohortScope === "beta"
      ? (sites || []).filter((item) => typeof item.owner_id === "string" && betaUserIds.has(item.owner_id))
      : sites || [];
  const providerRows =
    cohortScope === "beta"
      ? (providerUsage || []).filter(
          (item) => typeof item.user_id === "string" && betaUserIds.has(item.user_id)
        )
      : providerUsage || [];
  const architectFeedbackRows =
    cohortScope === "beta"
      ? (architectFeedback || []).filter(
          (item) => typeof item.user_id === "string" && betaUserIds.has(item.user_id)
        )
      : architectFeedback || [];

  const usersFor = (...names: string[]) =>
    new Set(
      eventRows
        .filter((item) => names.includes(item.event_name))
        .map((item) => item.user_id)
    );

  const openedUsers = usersFor("builder_open");
  const engagedUsers = usersFor(
    "step_story",
    "architect_generated",
    "architect_regenerated",
    "architect_applied",
    "revision_applied"
  );
  const reviewUsers = usersFor("step_review");
  const publishedUsers = usersFor("publish_success");
  const aiUsers = new Set(aiRows.map((item) => item.user_id));
  const feedbackUsers = new Set(feedbackRows.map((item) => item.user_id));

  const architectFirstRows = eventRows.filter(
    (item) => item.event_name === "architect_generated"
  );
  const architectRegeneratedRows = eventRows.filter(
    (item) => item.event_name === "architect_regenerated"
  );
  const architectRefinedRows = eventRows.filter(
    (item) => item.event_name === "architect_refined"
  );
  const architectFailedRows = eventRows.filter(
    (item) => item.event_name === "architect_failed"
  );
  const architectAppliedRows = eventRows.filter(
    (item) => item.event_name === "architect_applied"
  );
  const architectAttemptRows = [
    ...architectFirstRows,
    ...architectRegeneratedRows
  ];
  const architectRequestCount =
    architectAttemptRows.length + architectFailedRows.length;
  const architectUsers = new Set(
    architectAttemptRows.map((item) => item.user_id)
  );
  const architectRegeneratedUsers = new Set(
    architectRegeneratedRows.map((item) => item.user_id)
  );
  const architectAppliedUsers = new Set(
    architectAppliedRows.map((item) => item.user_id)
  );

  const positiveArchitectFeedback = architectFeedbackRows.filter(
    (item) => item.verdict === "positive"
  );
  const negativeArchitectFeedback = architectFeedbackRows.filter(
    (item) => item.verdict === "negative"
  );
  const reasonLabels: Record<string, string> = {
    need_mismatch: "Compréhension du besoin",
    copy: "Textes",
    structure: "Structure / rubriques",
    design: "Direction visuelle",
    generic: "Trop générique",
    other: "Autre"
  };
  const reasonCounts = new Map<string, number>();
  for (const item of negativeArchitectFeedback) {
    const reason = item.reason || "other";
    reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
  }
  const architectFeedbackReasons = [...reasonCounts.entries()]
    .map(([reason, count]) => ({
      reason: reasonLabels[reason] || reason,
      count
    }))
    .sort((a, b) => b.count - a.count);

  const ratings = feedbackRows
    .map((item) => item.rating)
    .filter((rating): rating is number => typeof rating === "number");
  const averageRating = ratings.length
    ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10
    : null;

  const publishedSites = new Set(
    eventRows
      .filter((item) => item.event_name === "publish_success" && item.site_id)
      .map((item) => item.site_id as string)
  );

  const activityBySite = siteRows
    .map((site) => {
      const siteEvents = eventRows.filter((item) => item.site_id === site.id);
      const siteFeedback = feedbackRows.filter((item) => item.site_id === site.id);
      if (!siteEvents.length && !siteFeedback.length) return null;

      const names = new Set(siteEvents.map((item) => item.event_name));
      const stage =
        names.has("publish_success")
          ? "published"
          : names.has("step_review")
            ? "review"
            : names.has("step_story") ||
                names.has("architect_generated") ||
                names.has("architect_regenerated") ||
                names.has("architect_applied") ||
                names.has("revision_applied")
              ? "engaged"
              : names.has("builder_open")
                ? "opened"
                : "feedback";

      const timestamps = [
        ...siteEvents.map((item) => item.created_at),
        ...siteFeedback.map((item) => item.created_at)
      ].filter(Boolean);

      return {
        siteId: site.id,
        slug: site.slug,
        status: site.status,
        stage,
        eventCount: siteEvents.length,
        aiApplyCount: siteEvents.filter((item) =>
          ["architect_applied", "revision_applied"].includes(item.event_name)
        ).length,
        feedbackCount: siteFeedback.length,
        lastActivity: timestamps.sort().at(-1) || site.updated_at
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity))
    .slice(0, 25);

  const opened = openedUsers.size;
  const engaged = engagedUsers.size;
  const reviewed = reviewUsers.size;
  const published = publishedUsers.size;

  const premiumProviderRows = providerRows.filter((item) =>
    String(item.operation || "").startsWith("premium_")
  );
  const standardProviderRows = providerRows.filter((item) =>
    String(item.operation || "").startsWith("standard_")
  );
  const premiumProvider = aggregateProviderUsage(premiumProviderRows);
  const standardProvider = aggregateProviderUsage(standardProviderRows);
  const premiumStrategyCalls = premiumProviderRows.filter(
    (item) => item.operation === "premium_strategy"
  ).length;

  return NextResponse.json(
    {
      periodDays: 30,
      generatedAt: new Date().toISOString(),
      cohort: {
        scope: cohortScope,
        size: betaUsers.length,
        activated: betaUsers.filter((user) => Boolean(user.last_sign_in_at)).length
      },
      funnel: {
        opened,
        engaged,
        reviewed,
        published,
        engagementRate: percent(engaged, opened),
        reviewRate: percent(reviewed, opened),
        publishRate: percent(published, opened),
        openedWithoutEngagement: Math.max(0, opened - engaged),
        openedWithoutPublication: Math.max(0, opened - published)
      },
      ai: {
        generations: aiRows.length,
        users: aiUsers.size,
        appliedUsers: usersFor("architect_applied", "revision_applied").size,
        architect: {
          attempts: architectAttemptRows.length,
          requests: architectRequestCount,
          failures: architectFailedRows.length,
          failureRate: percent(
            architectFailedRows.length,
            architectRequestCount
          ),
          firstGenerations: architectFirstRows.length,
          regenerations: architectRegeneratedRows.length,
          refinements: architectRefinedRows.length,
          applications: architectAppliedRows.length,
          users: architectUsers.size,
          regeneratedUsers: architectRegeneratedUsers.size,
          appliedUsers: architectAppliedUsers.size,
          regenerationRate: percent(
            architectRegeneratedRows.length,
            architectAttemptRows.length
          ),
          refinementRate: percent(
            architectRefinedRows.length,
            architectAttemptRows.length
          ),
          applicationRate: percent(
            architectAppliedRows.length,
            architectAttemptRows.length
          ),
          userAdoptionRate: percent(
            architectAppliedUsers.size,
            architectUsers.size
          ),
          humanEvaluation: {
            responses: architectFeedbackRows.length,
            positive: positiveArchitectFeedback.length,
            negative: negativeArchitectFeedback.length,
            positiveRate: percent(
              positiveArchitectFeedback.length,
              architectFeedbackRows.length
            ),
            responseRate: percent(
              architectFeedbackRows.length,
              architectAttemptRows.length
            ),
            reasons: architectFeedbackReasons
          },
          provider: {
            calls: premiumProvider.calls,
            inputTokens: premiumProvider.inputTokens,
            cachedInputTokens: premiumProvider.cachedInputTokens,
            outputTokens: premiumProvider.outputTokens,
            reasoningTokens: premiumProvider.reasoningTokens,
            totalTokens: premiumProvider.totalTokens,
            strategyCalls: premiumStrategyCalls,
            avgStrategyCallsPerRequest:
              architectRequestCount > 0
                ? Math.round((premiumStrategyCalls / architectRequestCount) * 100) / 100
                : 0,
            avgCallsPerAttempt:
              architectRequestCount > 0
                ? Math.round((premiumProvider.calls / architectRequestCount) * 10) / 10
                : 0,
            avgTokensPerAttempt:
              architectRequestCount > 0
                ? Math.round(premiumProvider.totalTokens / architectRequestCount)
                : 0,
            avgDurationMsPerCall: premiumProvider.avgDurationMsPerCall,
            byModel: premiumProvider.byModel
          }
        },
        standard: {
          provider: {
            calls: standardProvider.calls,
            inputTokens: standardProvider.inputTokens,
            cachedInputTokens: standardProvider.cachedInputTokens,
            outputTokens: standardProvider.outputTokens,
            reasoningTokens: standardProvider.reasoningTokens,
            totalTokens: standardProvider.totalTokens,
            avgTokensPerCall: standardProvider.avgTokensPerCall,
            avgDurationMsPerCall: standardProvider.avgDurationMsPerCall,
            byOperation: standardProvider.byOperation,
            byModel: standardProvider.byModel
          }
        }
      },
      feedback: {
        count: feedbackRows.length,
        users: feedbackUsers.size,
        averageRating,
        open: feedbackRows.filter((item) =>
          ["new", "reviewed", "planned"].includes(item.status)
        ).length
      },
      sites: {
        active: new Set(eventRows.map((item) => item.site_id).filter(Boolean)).size,
        published: publishedSites.size,
        activity: activityBySite
      },
      definitions: {
        opened: "Utilisateur distinct ayant ouvert le Builder sur les 30 derniers jours.",
        engaged:
          "Utilisateur distinct ayant atteint l’étape Message ou appliqué une proposition AI Site Architect/révision.",
        reviewed: "Utilisateur distinct ayant atteint l’étape Publication / revue.",
        published: "Utilisateur distinct ayant déclenché une publication réussie.",
        aiGenerations: "Générations IA réellement consommées dans le ledger serveur.",
        architectAttempts: "Propositions Premium effectivement rendues au client ; aucun brief ni contenu client n’est enregistré dans les événements.",
        architectFailureRate: "Part des demandes Premium lancées qui échouent après réservation du quota et ne renvoient aucune proposition exploitable.",
        architectRegenerationRate: "Part des tentatives Premium qui correspondent à une nouvelle proposition demandée après une première génération.",
        architectRefinementRate: "Part des propositions où l’audit Premium a déclenché un raffinement automatique avant affichage.",
        architectApplicationRate: "Applications de propositions Premium rapportées au nombre de tentatives sur la période.",
        architectUserAdoptionRate: "Part des utilisateurs de l’Architecte Premium ayant appliqué au moins une proposition.",
        architectProviderUsage: "Télémétrie serveur limitée aux modèles, tokens et durées. Aucun prompt, brief, texte généré ou contenu client n’est enregistré.",
        standardProviderUsage: "Même télémétrie minimale pour l’assistant standard : type d’usage, modèle, tokens et durée uniquement ; aucun contenu client n’est stocké.",
        architectHumanEvaluation: "Évaluation structurée Oui / À améliorer et motif catégorisé. Aucun commentaire libre ni contenu du site n’est stocké dans cette mesure.",
        cohort: cohortScope === "beta"
          ? "Métriques limitées aux comptes explicitement marqués dans la cohorte bêta."
          : "Aucune cohorte bêta définie : métriques calculées sur l’ensemble des utilisateurs."
      }
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    }
  );
}
