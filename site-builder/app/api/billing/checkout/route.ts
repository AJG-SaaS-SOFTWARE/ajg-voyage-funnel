import { NextResponse } from "next/server";
import {
  billingAppUrl,
  billingServiceClient,
  billingUserContext,
  ownedBillingSite
} from "../../../../lib/server-billing";
import {
  createStripeOneTimeCheckout,
  createStripeSubscriptionCheckout
} from "../../../../lib/stripe-billing";
import { localize, requestProductLocale } from "../../../../lib/server-locale";
import { commercialCheckoutReadiness } from "../../../../lib/commercial-checkout-readiness";

export const runtime = "nodejs";

type PaidPlanKey = "essential" | "growth";
type BillingCycle = "monthly" | "annual";
type PurchaseType = "subscription" | "ai_launch";

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
        ? "STRIPE_GROWTH_ANNUAL_PRICE_ID"
        : "STRIPE_GROWTH_MONTHLY_PRICE_ID";
  return process.env[envName]?.trim() || "";
}

function configuredTrialDays(planKey: PaidPlanKey, billingCycle: BillingCycle) {
  void planKey;
  void billingCycle;
  return 0;
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
          "Les paiements Stripe ne sont pas encore ouverts. La bêta reste gratuite.",
          "Stripe payments are not open yet. Beta access remains free."
        ),
        code: "checkout_disabled"
      },
      { status: 503 }
    );
  }

  const commercialReadiness = await commercialCheckoutReadiness();
  if (!commercialReadiness.ok) {
    console.error("ELTARA Checkout blocked by commercial readiness", {
      reasonCount: commercialReadiness.reasons.length,
      failedStripeChecks: commercialReadiness.stripeAudit
        .filter((item) => !item.ok)
        .map((item) => item.key)
    });
    return NextResponse.json(
      {
        error: tr(
          "Le paiement n’est pas encore disponible : les contrôles de mise en vente ne sont pas tous validés.",
          "Payment is not available yet: commercial launch checks are not all validated."
        ),
        code: "commercial_readiness_blocked"
      },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const siteId = typeof body?.siteId === "string" ? body.siteId : "";
  const purchaseType: PurchaseType =
    body?.purchaseType === "ai_launch" ? "ai_launch" : "subscription";

  if (!siteId) {
    return NextResponse.json(
      { error: tr("Le site doit être identifié.", "Website is required.") },
      { status: 400 }
    );
  }

  const site = await ownedBillingSite(auth.client, auth.user.id, siteId).catch(() => null);
  if (!site) {
    return NextResponse.json({ error: tr("Site introuvable.", "Website not found.") }, { status: 404 });
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
          "Votre statut Beta Tester inclut déjà l’accès complet sans paiement Stripe.",
          "Your Beta Tester status already includes full access without a Stripe payment."
        ),
        code: "beta_access_active"
      },
      { status: 409 }
    );
  }

  const { data: current, error: currentError } = await service
    .from("site_subscriptions")
    .select("plan_key,status,provider,provider_customer_id,provider_subscription_id,first_payment_confirmed_at")
    .eq("site_id", site.id)
    .maybeSingle();

  if (currentError) {
    return NextResponse.json(
      { error: tr("Impossible de vérifier l’abonnement actuel.", "Unable to verify the current subscription.") },
      { status: 503 }
    );
  }

  const appUrl = billingAppUrl(request);

  if (purchaseType === "ai_launch") {
    if (
      !current ||
      !["essential", "growth"].includes(current.plan_key) ||
      current.status !== "active" ||
      !current.first_payment_confirmed_at
    ) {
      return NextResponse.json(
        {
          error: tr(
            "La Création IA s’ajoute à un abonnement Essentiel ou Growth actif.",
            "AI Launch is available with an active Essential or Growth subscription."
          ),
          code: "subscription_required"
        },
        { status: 409 }
      );
    }

    const { data: launchRows, error: launchError } = await service
      .from("site_ai_launch_entitlements")
      .select("operations_total,operations_used,status,expires_at")
      .eq("site_id", site.id)
      .eq("owner_id", auth.user.id)
      .eq("status", "active");

    if (launchError) {
      return NextResponse.json(
        { error: tr("Impossible de vérifier votre droit Création IA.", "Unable to verify your AI Launch entitlement.") },
        { status: 503 }
      );
    }

    const hasRemainingLaunch = (launchRows || []).some((row: any) =>
      Number(row.operations_total) > Number(row.operations_used) &&
      (!row.expires_at || row.expires_at > now)
    );
    if (hasRemainingLaunch) {
      return NextResponse.json(
        {
          error: tr(
            "Une Création IA est déjà disponible pour ce site.",
            "An AI Launch entitlement is already available for this website."
          ),
          code: "ai_launch_already_available"
        },
        { status: 409 }
      );
    }

    const priceId = process.env.STRIPE_AI_LAUNCH_PRICE_ID?.trim() || "";
    if (!priceId) {
      return NextResponse.json(
        { error: tr("Le tarif Création IA n’est pas configuré.", "AI Launch pricing is not configured.") },
        { status: 503 }
      );
    }

    try {
      const session = await createStripeOneTimeCheckout({
        siteId: site.id,
        ownerId: auth.user.id,
        ownerEmail: auth.user.email,
        customerId:
          current?.provider === "stripe" ? current.provider_customer_id : null,
        priceId,
        successUrl: `${appUrl}/plans?aiLaunch=success&siteId=${encodeURIComponent(site.id)}`,
        cancelUrl: `${appUrl}/plans?aiLaunch=cancel&siteId=${encodeURIComponent(site.id)}`
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
        purchaseType: "ai_launch"
      });
    } catch (error) {
      console.error("Stripe AI Launch Checkout creation failed", {
        code: error instanceof Error ? error.message : "unknown"
      });
      return NextResponse.json(
        { error: tr("Impossible d’ouvrir le paiement Création IA.", "Unable to open AI Launch checkout.") },
        { status: 502 }
      );
    }
  }

  const planKey: PaidPlanKey | "" =
    body?.planKey === "essential" || body?.planKey === "growth" ? body.planKey : "";
  const billingCycle: BillingCycle | "" =
    body?.billingCycle === "monthly" || body?.billingCycle === "annual"
      ? body.billingCycle
      : "";

  if (!planKey || !billingCycle) {
    return NextResponse.json(
      { error: tr("L’offre et la périodicité doivent être identifiées.", "Plan and billing cycle are required.") },
      { status: 400 }
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
          "Un abonnement Stripe existe déjà pour ce site. Utilisez l’espace de facturation pour le modifier.",
          "A Stripe subscription already exists for this website. Use Billing to change it."
        ),
        code: "existing_subscription"
      },
      { status: 409 }
    );
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

  const trialDays = configuredTrialDays(planKey, billingCycle);

  try {
    const session = await createStripeSubscriptionCheckout({
      siteId: site.id,
      ownerId: auth.user.id,
      ownerEmail: auth.user.email,
      customerId:
        current?.provider === "stripe" ? current.provider_customer_id : null,
      priceId,
      planKey,
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
      trialDays
    });
  } catch (error) {
    console.error("Stripe subscription Checkout creation failed", {
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
