import { NextResponse } from "next/server";
import {
  billingAppUrl,
  billingServiceClient,
  billingUserContext,
  ownedBillingSite
} from "../../../../lib/server-billing";
import { createStripeSubscriptionCheckout } from "../../../../lib/stripe-billing";
import { localize, requestProductLocale } from "../../../../lib/server-locale";

export const runtime = "nodejs";

type PaidPlanKey = "essential" | "pro";
type BillingCycle = "monthly" | "annual";

function checkoutEnabled() {
  return process.env.AJG_BILLING_CHECKOUT_ENABLED?.trim().toLowerCase() === "true";
}

function configuredPriceId(planKey: PaidPlanKey, billingCycle: BillingCycle) {
  const envName =
    planKey === "essential"
      ? billingCycle === "annual"
        ? "STRIPE_ESSENTIAL_ANNUAL_PRICE_ID"
        : "STRIPE_ESSENTIAL_MONTHLY_PRICE_ID"
      : billingCycle === "annual"
        ? "STRIPE_PRO_ANNUAL_PRICE_ID"
        : "STRIPE_PRO_MONTHLY_PRICE_ID";
  return process.env[envName]?.trim() || "";
}

export async function POST(request: Request) {
  const locale = requestProductLocale(request);
  const tr = (fr: string, en: string) => localize(locale, fr, en);
  const auth = await billingUserContext(request);
  if (!auth) {
    return NextResponse.json(
      { error: tr("Reconnectez-vous pour gérer votre abonnement.", "Sign in again to manage your subscription.") },
      { status: 401 }
    );
  }

  if (!checkoutEnabled()) {
    return NextResponse.json(
      {
        error: tr(
          "Les souscriptions Stripe ne sont pas encore ouvertes. La bêta reste gratuite.",
          "Stripe subscriptions are not open yet. Beta access remains free."
        ),
        code: "checkout_disabled"
      },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const siteId = typeof body?.siteId === "string" ? body.siteId : "";
  const planKey: PaidPlanKey | "" =
    body?.planKey === "essential" || body?.planKey === "pro" ? body.planKey : "";
  const billingCycle: BillingCycle | "" =
    body?.billingCycle === "monthly" || body?.billingCycle === "annual"
      ? body.billingCycle
      : "";

  if (!siteId || !planKey || !billingCycle) {
    return NextResponse.json(
      { error: tr("Le site, l’offre et la périodicité doivent être identifiés.", "Website, plan and billing cycle are required.") },
      { status: 400 }
    );
  }

  const site = await ownedBillingSite(auth.client, auth.user.id, siteId).catch(() => null);
  if (!site) {
    return NextResponse.json({ error: tr("Site introuvable.", "Website not found.") }, { status: 404 });
  }

  const priceId = configuredPriceId(planKey, billingCycle);
  if (!priceId) {
    return NextResponse.json(
      {
        error: tr(
          "Ce tarif Stripe n’est pas encore activé sur cet environnement.",
          "This Stripe price is not enabled in this environment yet."
        )
      },
      { status: 503 }
    );
  }

  const service = billingServiceClient();
  if (!service) {
    return NextResponse.json(
      { error: tr("La facturation serveur n’est pas configurée.", "Server-side billing is not configured.") },
      { status: 503 }
    );
  }

  const now = new Date().toISOString();
  const { data: betaGrant, error: betaError } = await service
    .from("beta_access_grants")
    .select("active,starts_at,expires_at")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (betaError) {
    return NextResponse.json(
      { error: tr("Impossible de vérifier le statut bêta.", "Unable to verify beta access.") },
      { status: 503 }
    );
  }

  if (
    betaGrant?.active === true &&
    betaGrant.starts_at <= now &&
    betaGrant.expires_at > now
  ) {
    return NextResponse.json(
      {
        error: tr(
          "Votre statut Beta Tester inclut déjà Pro IA sans abonnement Stripe.",
          "Your Beta Tester status already includes Pro AI without a Stripe subscription."
        ),
        code: "beta_access_active"
      },
      { status: 409 }
    );
  }

  const { data: current, error: currentError } = await service
    .from("site_subscriptions")
    .select("plan_key,status,provider,provider_customer_id,provider_subscription_id")
    .eq("site_id", site.id)
    .maybeSingle();

  if (currentError) {
    return NextResponse.json(
      { error: tr("Impossible de vérifier l’abonnement actuel.", "Unable to verify the current subscription.") },
      { status: 503 }
    );
  }

  if (
    current?.provider === "stripe" &&
    current.provider_subscription_id &&
    ["active", "trialing", "past_due"].includes(current.status)
  ) {
    return NextResponse.json(
      {
        error: tr(
          "Un abonnement Stripe existe déjà pour ce site. Utilisez l’espace de facturation pour le gérer.",
          "A Stripe subscription already exists for this website. Use Billing to manage it."
        ),
        code: "existing_subscription"
      },
      { status: 409 }
    );
  }

  const appUrl = billingAppUrl(request);
  try {
    const session = await createStripeSubscriptionCheckout({
      siteId: site.id,
      ownerId: auth.user.id,
      ownerEmail: auth.user.email,
      customerId:
        current?.provider === "stripe" ? current.provider_customer_id : null,
      priceId,
      planKey,
      trialDays: 14,
      successUrl: `${appUrl}/billing?checkout=success&siteId=${encodeURIComponent(site.id)}`,
      cancelUrl: `${appUrl}/plans?checkout=cancel&siteId=${encodeURIComponent(site.id)}`
    });

    if (!session.url) {
      return NextResponse.json(
        { error: tr("Stripe n’a pas renvoyé de page de paiement.", "Stripe did not return a checkout page.") },
        { status: 502 }
      );
    }

    return NextResponse.json({
      url: session.url,
      checkoutSessionId: session.id,
      planKey,
      billingCycle,
      trialDays: 14
    });
  } catch (error) {
    console.error("Stripe Checkout session creation failed", {
      code: error instanceof Error ? error.message : "unknown",
      planKey,
      billingCycle
    });
    return NextResponse.json(
      { error: tr("Impossible d’ouvrir Stripe Checkout pour le moment.", "Unable to open Stripe Checkout right now.") },
      { status: 502 }
    );
  }
}
