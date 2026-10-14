import "server-only";

import { authorizedReportingRequest } from "./cockpit-reporting-auth";
import { billingServiceClient } from "./server-billing";
import {
  commercialCheckoutReadiness,
  commercialConfigurationReadiness
} from "./commercial-checkout-readiness";
import { auditOpenAiRuntimeCached } from "./openai-readiness";
import {
  releaseE2ERunDecision,
  type ReleaseE2ERunSnapshot
} from "./release-e2e-policy";

type BuilderSubscriptionRow = {
  plan_key: string;
  status: string;
  provider: string | null;
  provider_price_id: string | null;
};

const recurringPrices = [
  {
    planKey: "essential",
    cycle: "monthly",
    amountCents: 1500,
    env: "STRIPE_ESSENTIAL_MONTHLY_PRICE_ID"
  },
  {
    planKey: "essential",
    cycle: "annual",
    amountCents: 15000,
    env: "STRIPE_ESSENTIAL_ANNUAL_PRICE_ID"
  },
  {
    planKey: "growth",
    cycle: "monthly",
    amountCents: 2900,
    env: "STRIPE_GROWTH_MONTHLY_PRICE_ID"
  },
  {
    planKey: "growth",
    cycle: "annual",
    amountCents: 29000,
    env: "STRIPE_GROWTH_ANNUAL_PRICE_ID"
  }
] as const;

function mappedMonthlyRevenue(
  row: BuilderSubscriptionRow,
  env: Record<string, string | undefined> = process.env
) {
  if (row.provider !== "stripe" || !row.provider_price_id) return null;
  const price = recurringPrices.find(
    (candidate) =>
      candidate.planKey === row.plan_key &&
      env[candidate.env]?.trim() === row.provider_price_id
  );
  if (!price) return null;
  return price.cycle === "monthly"
    ? price.amountCents
    : Math.round(price.amountCents / 12);
}

export function calculateBuilderRecurringRevenue(
  rows: BuilderSubscriptionRow[],
  env: Record<string, string | undefined> = process.env
) {
  let mrrCents = 0;
  let activeCustomers = 0;
  let trialCustomers = 0;
  let pastDueCustomers = 0;
  let unmappedActivePrices = 0;

  for (const row of rows) {
    if (!["essential", "growth"].includes(row.plan_key)) continue;

    if (row.status === "active") {
      activeCustomers += 1;
      const monthlyRevenue = mappedMonthlyRevenue(row, env);
      if (monthlyRevenue === null) unmappedActivePrices += 1;
      else mrrCents += monthlyRevenue;
    } else if (row.status === "trialing") {
      trialCustomers += 1;
    } else if (row.status === "past_due") {
      pastDueCustomers += 1;
    }
  }

  return {
    mrrCents,
    arrCents: mrrCents * 12,
    activeCustomers,
    trialCustomers,
    pastDueCustomers,
    unmappedActivePrices
  };
}

export function authorizedCockpitRequest(
  authorization: string | null,
  expectedToken = process.env.AJG_COCKPIT_REPORTING_TOKEN?.trim() || ""
) {
  return authorizedReportingRequest(authorization, expectedToken);
}

function stripeMode() {
  const key = (
    process.env.STRIPE_RESTRICTED_KEY ||
    process.env.STRIPE_SECRET_KEY ||
    ""
  ).trim();
  if (key.startsWith("rk_test_") || key.startsWith("sk_test_")) return "test" as const;
  if (
    (key.startsWith("rk_live_") || key.startsWith("sk_live_")) &&
    process.env.AJG_BILLING_CHECKOUT_ENABLED?.trim().toLowerCase() === "true"
  ) {
    return "live" as const;
  }
  return "unconfigured" as const;
}

async function exactCount(query: PromiseLike<{
  count: number | null;
  error: { message?: string } | null;
}>) {
  const { count, error } = await query;
  if (error) throw new Error("builder_business_reporting_query_failed");
  return count || 0;
}

export async function buildBuilderBusinessReport() {
  const service = billingServiceClient();
  if (!service) throw new Error("builder_business_reporting_not_configured");

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: subscriptions, error: subscriptionsError } = await service
    .from("site_subscriptions")
    .select("plan_key,status,provider,provider_price_id");

  if (subscriptionsError) {
    throw new Error("builder_business_reporting_subscription_query_failed");
  }

  const recurring = calculateBuilderRecurringRevenue(
    (subscriptions || []) as BuilderSubscriptionRow[]
  );

  const { data: latestBetaRun, error: betaRunError } = await service
    .from("beta_operations_runs")
    .select(
      "completed_at,status,active_tester_count,follow_up_candidates,awaiting_resume,unresponsive_after_followup,completed_missions,repair_failures"
    )
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const betaOperations = betaRunError || !latestBetaRun
    ? {
        status: "unavailable" as const,
        activeTesterCount: 0,
        followUpCandidates: 0,
        awaitingResume: 0,
        unresponsiveAfterFollowUp: 0,
        completedMissions: 0,
        checkedAt: null
      }
    : {
        status:
          latestBetaRun.status === "failed"
            ? ("failed" as const)
            : latestBetaRun.status === "attention"
              ? ("attention" as const)
              : ("healthy" as const),
        activeTesterCount: latestBetaRun.active_tester_count || 0,
        followUpCandidates: latestBetaRun.follow_up_candidates || 0,
        awaitingResume: latestBetaRun.awaiting_resume || 0,
        unresponsiveAfterFollowUp: latestBetaRun.unresponsive_after_followup || 0,
        completedMissions: latestBetaRun.completed_missions || 0,
        checkedAt: latestBetaRun.completed_at || null
      };

  const { data: latestSupportRun, error: supportRunError } = await service
    .from("support_operations_runs")
    .select(
      "completed_at,status,reconcile_escalated,reconcile_failed,remediation_succeeded,remediation_failed,platform_repaired,platform_failed,runtime_status,reported_to_run"
    )
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const supportOperations = supportRunError || !latestSupportRun
    ? {
        status: "unavailable" as const,
        checkedAt: null,
        escalatedTickets: 0,
        failedChecks: 0,
        repairsSucceeded: 0,
        runtimeStatus: "unknown" as const,
        reportedToRun: false
      }
    : {
        status:
          latestSupportRun.status === "failed"
            ? ("failed" as const)
            : latestSupportRun.status === "attention"
              ? ("attention" as const)
              : ("healthy" as const),
        checkedAt: latestSupportRun.completed_at || null,
        escalatedTickets: latestSupportRun.reconcile_escalated || 0,
        failedChecks:
          (latestSupportRun.reconcile_failed || 0) +
          (latestSupportRun.remediation_failed || 0) +
          (latestSupportRun.platform_failed || 0),
        repairsSucceeded:
          (latestSupportRun.remediation_succeeded || 0) +
          (latestSupportRun.platform_repaired || 0),
        runtimeStatus: latestSupportRun.runtime_status || "unknown",
        reportedToRun: Boolean(latestSupportRun.reported_to_run)
      };

  const [
    successful30d,
    failed30d,
    refunds30d,
    failedProviderEvents
  ] = await Promise.all([
    exactCount(
      service
        .from("billing_provider_events")
        .select("event_id", { count: "exact", head: true })
        .eq("provider", "stripe")
        .eq("event_type", "invoice.paid")
        .eq("processing_status", "processed")
        .gte("received_at", since)
    ),
    exactCount(
      service
        .from("billing_provider_events")
        .select("event_id", { count: "exact", head: true })
        .eq("provider", "stripe")
        .eq("event_type", "invoice.payment_failed")
        .eq("processing_status", "processed")
        .gte("received_at", since)
    ),
    exactCount(
      service
        .from("billing_provider_events")
        .select("event_id", { count: "exact", head: true })
        .eq("provider", "stripe")
        .eq("event_type", "charge.refunded")
        .eq("processing_status", "processed")
        .gte("received_at", since)
    ),
    exactCount(
      service
        .from("billing_provider_events")
        .select("event_id", { count: "exact", head: true })
        .eq("provider", "stripe")
        .eq("processing_status", "failed")
        .gte("received_at", since)
    )
  ]);

  const openAiRuntime = await auditOpenAiRuntimeCached();
  const deploymentSha = (
    process.env.AJG_RELEASE_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    ""
  ).trim();

  let e2eMirrorState: "validated" | "pending" | "blocked" | "unavailable" =
    deploymentSha ? "pending" : "unavailable";
  let validatedLocales = 0;

  if (deploymentSha) {
    let unavailable = false;
    let retryBudgetExhausted = false;

    for (const locale of ["fr", "en"] as const) {
      const { data, error } = await service
        .from("builder_e2e_runs")
        .select("status,completed_at")
        .eq("deployment_sha", deploymentSha)
        .eq("locale", locale)
        .eq("include_ai", true)
        .order("started_at", { ascending: false })
        .limit(10);

      if (error) {
        unavailable = true;
        continue;
      }

      const decision = releaseE2ERunDecision(
        (data || []) as ReleaseE2ERunSnapshot[]
      );
      if (decision.reason === "already_validated") validatedLocales += 1;
      if (decision.reason === "retry_budget_exhausted") {
        retryBudgetExhausted = true;
      }
    }

    e2eMirrorState = unavailable
      ? "unavailable"
      : retryBudgetExhausted
        ? "blocked"
        : validatedLocales === 2
          ? "validated"
          : "pending";
  }

  const betaRuntime = {
    openAi: openAiRuntime.status,
    e2eMirror: e2eMirrorState,
    validatedLocales,
    requiredLocales: 2
  } as const;

  const commercialConfig = commercialConfigurationReadiness();
  const commercial = await commercialCheckoutReadiness();
  const checkoutEnabled =
    process.env.AJG_BILLING_CHECKOUT_ENABLED?.trim().toLowerCase() === "true";
  const stripeRuntimeReady =
    commercial.stripeAudit.length > 0 &&
    commercial.stripeAudit.every((item) => item.ok);
  const commercialLaunchState =
    checkoutEnabled && commercial.ok
      ? "open"
      : checkoutEnabled && !commercial.ok
        ? "blocked"
        : commercial.ok
          ? "ready"
          : "closed";

  const status =
    failedProviderEvents > 0 ||
    commercialLaunchState === "blocked" ||
    betaOperations.status === "failed" ||
    supportOperations.status === "failed" ||
    supportOperations.runtimeStatus === "incident" ||
    betaRuntime.openAi === "blocker" ||
    betaRuntime.e2eMirror === "blocked"
      ? "critical"
      : recurring.pastDueCustomers > 0 ||
          failed30d > 0 ||
          recurring.unmappedActivePrices > 0 ||
          betaOperations.status === "attention" ||
          betaOperations.status === "unavailable" ||
          supportOperations.status === "attention" ||
          supportOperations.status === "unavailable" ||
          supportOperations.failedChecks > 0 ||
          betaRuntime.openAi === "warn" ||
          ["pending", "unavailable"].includes(betaRuntime.e2eMirror)
        ? "warning"
        : "healthy";

  let detail = "Reporting agrégé ELTARA. Aucun identifiant utilisateur, site, client Stripe ou abonnement n’est exposé.";
  if (commercialLaunchState === "blocked") {
    detail = "Checkout ELTARA est activé alors que la readiness commerciale n’est pas conforme.";
  } else if (failedProviderEvents > 0) {
    detail = `${failedProviderEvents} événement(s) Stripe Builder nécessitent une reprise automatique.`;
  } else if (betaRuntime.openAi === "blocker") {
    detail = "Le fournisseur IA refuse la configuration runtime ELTARA ; une intervention sur le credential serveur est requise.";
  } else if (betaRuntime.e2eMirror === "blocked") {
    detail = "Le miroir E2E FR/EN du déploiement courant a épuisé son budget de reprises automatiques.";
  } else if (supportOperations.status === "failed") {
    detail = "L’agent Support/RUN ELTARA est en échec et nécessite une intervention technique.";
  } else if (supportOperations.runtimeStatus === "incident") {
    detail = "L’agent Support/RUN détecte un incident runtime production.";
  } else if (betaOperations.status === "failed") {
    detail = "L’agent de suivi bêta ELTARA est en échec et nécessite une intervention technique.";
  } else if (betaRuntime.openAi === "warn") {
    detail = "Le contrôle fournisseur IA est temporairement incertain.";
  } else if (betaRuntime.e2eMirror === "pending") {
    detail = `Validation E2E miroir en attente : ${betaRuntime.validatedLocales}/${betaRuntime.requiredLocales} locale(s) validée(s).`;
  } else if (betaRuntime.e2eMirror === "unavailable") {
    detail = "L’état E2E miroir du déploiement courant est indisponible.";
  } else if (betaOperations.status === "attention") {
    detail = `${betaOperations.followUpCandidates} relance(s) Beta Tester à préparer · ${betaOperations.unresponsiveAfterFollowUp} sans reprise après relance.`;
  } else if (betaOperations.status === "unavailable") {
    detail = "Le dernier état agrégé du suivi bêta ELTARA est indisponible.";
  } else if (supportOperations.status === "attention" || supportOperations.failedChecks > 0) {
    detail = `Agent Support/RUN à surveiller : ${supportOperations.failedChecks} échec(s) technique(s) agrégé(s).`;
  } else if (supportOperations.status === "unavailable") {
    detail = "Le dernier état agrégé de l’agent Support/RUN ELTARA est indisponible.";
  } else if (recurring.unmappedActivePrices > 0) {
    detail = `${recurring.unmappedActivePrices} abonnement(s) actif(s) utilisent un Price ID non reconnu par le catalogue Builder.`;
  }

  return {
    status,
    currency: "EUR",
    mrrCents: recurring.mrrCents,
    arrCents: recurring.arrCents,
    activeCustomers: recurring.activeCustomers,
    trialCustomers: recurring.trialCustomers,
    pastDueCustomers: recurring.pastDueCustomers,
    churn30dPct: null,
    trialConversion30dPct: null,
    payments: {
      provider: "stripe",
      mode: stripeMode(),
      successful30d,
      failed30d,
      refunds30d,
      processedVolume30dCents: 0,
      connectedAccounts: 0,
      connectOnboardingPending: 0,
      connectChargesDisabled: 0,
      connectPayoutsDisabled: 0
    },
    commercialLaunch: {
      state: commercialLaunchState,
      checkoutEnabled,
      blockerCount: commercial.reasons.length,
      legalReady: commercialConfig.legal.ok,
      taxReady: commercialConfig.tax.ok,
      stripeConfigured: commercialConfig.stripe.ok,
      stripeRuntimeReady
    },
    betaOperations,
    supportOperations,
    betaRuntime,
    detail,
    checkedAt: new Date().toISOString()
  } as const;
}
