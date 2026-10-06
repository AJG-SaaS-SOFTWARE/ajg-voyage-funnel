import "server-only";

import { authorizedReportingRequest } from "./cockpit-reporting-auth";
import { billingServiceClient } from "./server-billing";

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

  const status =
    failedProviderEvents > 0
      ? "critical"
      : recurring.pastDueCustomers > 0 ||
          failed30d > 0 ||
          recurring.unmappedActivePrices > 0
        ? "warning"
        : "healthy";

  const detail =
    failedProviderEvents > 0
      ? `${failedProviderEvents} événement(s) Stripe ELTARA nécessitent une reprise automatique.`
      : recurring.unmappedActivePrices > 0
        ? `${recurring.unmappedActivePrices} abonnement(s) actif(s) utilisent un Price ID non reconnu par le catalogue ELTARA.`
        : "Reporting agrégé ELTARA. Aucun identifiant utilisateur, site, client Stripe ou abonnement n’est exposé.";

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
    detail,
    checkedAt: new Date().toISOString()
  } as const;
}
