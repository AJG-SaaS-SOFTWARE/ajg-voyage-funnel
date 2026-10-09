import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { releaseE2EAuthorized } from "../../../../lib/release-e2e-auth";
import { stripeCredentialMode } from "../../../../lib/stripe-billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PURPOSE = "eltara_provider_billing_e2e";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function checkoutClosed() {
  return process.env.AJG_BILLING_CHECKOUT_ENABLED?.trim().toLowerCase() !== "true";
}

function safeId(value: unknown) {
  return typeof value === "string" && /^[a-f0-9-]{20,80}$/i.test(value)
    ? value
    : "";
}

export async function POST(request: NextRequest) {
  if (!releaseE2EAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!checkoutClosed()) {
    return NextResponse.json(
      { error: "Provider billing E2E harness is disabled while commercial Checkout is open." },
      { status: 409 }
    );
  }

  if (stripeCredentialMode() !== "test") {
    return NextResponse.json(
      { error: "Stripe sandbox runtime is required." },
      { status: 409 }
    );
  }

  const service = serviceClient();
  if (!service) {
    return NextResponse.json(
      { error: "Provider billing E2E harness is not configured." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const action = typeof body?.action === "string" ? body.action : "";

  if (action === "provision") {
    const attemptId = crypto.randomUUID();
    const suffix = attemptId.replace(/-/g, "").slice(0, 12);
    const email = `provider-billing-e2e-${suffix}@example.invalid`;

    const { data: created, error: createError } =
      await service.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          purpose: PURPOSE,
          attempt_id: attemptId
        }
      });

    if (createError || !created.user) {
      console.error("ELTARA provider billing E2E user provision failed", {
        code: createError?.message || "temporary_user_creation_failed"
      });
      return NextResponse.json(
        { error: "temporary_user_creation_failed" },
        { status: 503 }
      );
    }

    const ownerId = created.user.id;
    const { data: site, error: siteError } = await service
      .from("sites")
      .insert({
        owner_id: ownerId,
        slug: `provider-billing-e2e-${suffix}`,
        status: "draft",
        primary_language: "fr",
        enabled_languages: ["fr"],
        brand_name: "ELTARA Provider Billing E2E",
        first_name: "Provider",
        last_name: "E2E",
        hero_title: "ELTARA Provider Billing E2E",
        hero_subtitle: "Temporary real Stripe sandbox lifecycle validation.",
        hero_tagline: "E2E",
        about_heading: "Validation",
        about_text: "Temporary provider-backed billing lifecycle validation.",
        booking_label: "Contact",
        booking_url: "",
        instagram_url: "",
        facebook_url: "",
        profile_image_url: "",
        show_travel_journals: false,
        compliance_profile: "independent-v1",
        design_assets: {},
        legal_config: {},
        public_access_state: "live"
      })
      .select("id")
      .single();

    if (siteError || !site) {
      await service.auth.admin.deleteUser(ownerId).catch(() => undefined);
      console.error("ELTARA provider billing E2E site provision failed", {
        code: siteError?.message || "temporary_site_creation_failed"
      });
      return NextResponse.json(
        { error: "temporary_site_creation_failed" },
        { status: 503 }
      );
    }

    const growthMonthlyPriceId =
      process.env.STRIPE_GROWTH_MONTHLY_PRICE_ID?.trim() || "";

    if (!growthMonthlyPriceId) {
      await service.auth.admin.deleteUser(ownerId).catch(() => undefined);
      return NextResponse.json(
        { error: "Stripe Growth sandbox price is not configured." },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ok: true,
      action,
      attemptId,
      ownerId,
      siteId: site.id,
      growthMonthlyPriceId,
      checkoutEnabled: false,
      sandbox: true
    });
  }

  const ownerId = safeId(body?.ownerId);
  const siteId = safeId(body?.siteId);
  const attemptId =
    typeof body?.attemptId === "string" &&
    /^[a-f0-9-]{20,80}$/i.test(body.attemptId)
      ? body.attemptId
      : "";

  if (!ownerId || !siteId || !attemptId) {
    return NextResponse.json({ error: "Invalid E2E identifiers." }, { status: 400 });
  }

  const { data: userData, error: userError } =
    await service.auth.admin.getUserById(ownerId);
  const purpose = userData?.user?.user_metadata?.purpose;
  const storedAttempt = userData?.user?.user_metadata?.attempt_id;

  if (
    userError ||
    !userData?.user ||
    purpose !== PURPOSE ||
    storedAttempt !== attemptId
  ) {
    return NextResponse.json({ error: "Unknown E2E fixture." }, { status: 404 });
  }

  const { data: site, error: siteError } = await service
    .from("sites")
    .select("id,owner_id,brand_name")
    .eq("id", siteId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (
    siteError ||
    !site ||
    site.brand_name !== "ELTARA Provider Billing E2E"
  ) {
    return NextResponse.json({ error: "Unknown E2E fixture." }, { status: 404 });
  }

  if (action === "status") {
    const [
      { data: subscription, error: subscriptionError },
      { data: billing, error: billingError },
      { count: activeLaunches, error: launchError }
    ] = await Promise.all([
      service
        .from("site_subscriptions")
        .select(
          "plan_key,status,provider,provider_customer_id,provider_subscription_id,provider_price_id,first_payment_confirmed_at,current_period_end"
        )
        .eq("site_id", siteId)
        .maybeSingle(),
      service
        .from("site_billing_states")
        .select("state,grace_expires_at,failed_at")
        .eq("site_id", siteId)
        .maybeSingle(),
      service
        .from("site_ai_launch_entitlements")
        .select("id", { count: "exact", head: true })
        .eq("site_id", siteId)
        .eq("owner_id", ownerId)
        .eq("source", "stripe_purchase")
        .eq("status", "active")
    ]);

    if (subscriptionError || billingError || launchError) {
      console.error("ELTARA provider billing E2E status failed", {
        subscription: subscriptionError?.message || null,
        billing: billingError?.message || null,
        launch: launchError?.message || null
      });
      return NextResponse.json(
        { error: "provider_billing_status_failed" },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ok: true,
      action,
      checkoutEnabled: false,
      sandbox: true,
      subscription: subscription
        ? {
            planKey: subscription.plan_key,
            status: subscription.status,
            provider: subscription.provider,
            hasCustomer: Boolean(subscription.provider_customer_id),
            hasSubscription: Boolean(subscription.provider_subscription_id),
            hasPrice: Boolean(subscription.provider_price_id),
            firstPaymentConfirmed: Boolean(subscription.first_payment_confirmed_at),
            paidThrough: subscription.current_period_end || null
          }
        : null,
      billing: billing
        ? {
            state: billing.state,
            hasFailure: Boolean(billing.failed_at),
            hasGraceExpiry: Boolean(billing.grace_expires_at)
          }
        : null,
      activeAiLaunchEntitlements: activeLaunches || 0
    });
  }

  if (action === "cleanup") {
    const { error: deleteError } =
      await service.auth.admin.deleteUser(ownerId);
    if (deleteError) {
      console.error("ELTARA provider billing E2E cleanup failed", {
        code: deleteError.message
      });
      return NextResponse.json(
        { ok: false, action, cleanupOk: false },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ok: true,
      action,
      cleanupOk: true,
      checkoutEnabled: false,
      sandbox: true
    });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
