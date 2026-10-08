import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { releaseE2EAuthorized } from "../../../../lib/release-e2e-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Snapshot = {
  label: string;
  result: string;
  subscriptionStatus: string | null;
  billingState: string | null;
  firstPaymentConfirmed: boolean;
  canPublish: boolean;
  canGenerateAi: boolean;
};

function iso(offsetMs: number) {
  return new Date(Date.now() + offsetMs).toISOString();
}

export async function GET(request: NextRequest) {
  if (!releaseE2EAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.AJG_BILLING_CHECKOUT_ENABLED?.trim().toLowerCase() === "true") {
    return NextResponse.json(
      { error: "Billing lifecycle smoke is disabled while commercial Checkout is open." },
      { status: 409 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  const priceId = process.env.STRIPE_GROWTH_MONTHLY_PRICE_ID?.trim() || "";

  if (!url || !publishable || !serviceKey || !priceId) {
    return NextResponse.json(
      { error: "Billing lifecycle smoke is not configured." },
      { status: 503 }
    );
  }

  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const email = `billing-e2e-${suffix}@example.invalid`;
  const password =
    crypto.randomUUID().replace(/-/g, "") +
    crypto.randomUUID().replace(/-/g, "");
  const eventIds = [
    `billing-e2e-${suffix}-projection`,
    `billing-e2e-${suffix}-paid`,
    `billing-e2e-${suffix}-failed`,
    `billing-e2e-${suffix}-recovered`,
    `billing-e2e-${suffix}-canceled`
  ];
  const customerId = `cus_e2e_${suffix}`;
  const subscriptionId = `sub_e2e_${suffix}`;
  let userId = "";
  let siteId = "";
  let cleanupOk = true;

  const cleanup = async () => {
    const { error: eventCleanupError } = await service
      .from("billing_provider_events")
      .delete()
      .eq("provider", "stripe_e2e")
      .in("event_id", eventIds);
    if (eventCleanupError) cleanupOk = false;

    if (userId) {
      const { error: userCleanupError } = await service.auth.admin.deleteUser(userId);
      if (userCleanupError) {
        cleanupOk = false;
        await service.from("sites").delete().eq("owner_id", userId);
        await service.auth.admin.updateUserById(userId, {
          ban_duration: "876000h"
        });
      }
    }
  };

  try {
    const { data: created, error: createError } =
      await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { purpose: "eltara_billing_lifecycle_e2e" }
      });
    if (createError || !created.user) {
      throw createError || new Error("temporary_user_creation_failed");
    }
    userId = created.user.id;

    const authClient = createClient(url, publishable, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: sessionData, error: signInError } =
      await authClient.auth.signInWithPassword({ email, password });
    if (signInError || !sessionData.session?.access_token) {
      throw signInError || new Error("temporary_user_sign_in_failed");
    }

    const { data: site, error: siteError } = await service
      .from("sites")
      .insert({
        owner_id: userId,
        slug: `billing-e2e-${suffix}`,
        status: "draft",
        primary_language: "fr",
        enabled_languages: ["fr"],
        brand_name: "ELTARA Billing E2E",
        first_name: "Billing",
        last_name: "E2E",
        hero_title: "ELTARA Billing E2E",
        hero_subtitle: "Temporary billing lifecycle validation.",
        hero_tagline: "E2E",
        about_heading: "Validation",
        about_text: "Temporary billing lifecycle validation.",
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
      throw siteError || new Error("temporary_site_creation_failed");
    }
    siteId = site.id;

    const snapshot = async (
      label: string,
      eventId: string,
      eventType: string,
      providerStatus: string,
      providerCreatedAt: string,
      failedAt: string | null = null
    ): Promise<Snapshot> => {
      const { data: result, error: eventError } = await service.rpc(
        "apply_builder_site_billing_provider_event_v2",
        {
          p_provider: "stripe_e2e",
          p_event_id: eventId,
          p_event_type: eventType,
          p_site_id: siteId,
          p_owner_id: userId,
          p_plan_key: "growth",
          p_provider_customer_id: customerId,
          p_provider_subscription_id: subscriptionId,
          p_provider_price_id: priceId,
          p_provider_status: providerStatus,
          p_paid_through: iso(30 * 24 * 60 * 60 * 1000),
          p_failed_at: failedAt,
          p_provider_created_at: providerCreatedAt
        }
      );
      if (eventError) throw eventError;

      const [{ data: subscription, error: subscriptionError }, { data: billing, error: billingError }, { data: capabilities, error: capabilityError }] =
        await Promise.all([
          service
            .from("site_subscriptions")
            .select("status,first_payment_confirmed_at")
            .eq("site_id", siteId)
            .single(),
          service
            .from("site_billing_states")
            .select("state")
            .eq("site_id", siteId)
            .maybeSingle(),
          authClient.rpc("get_my_site_capabilities", { p_site_id: siteId })
        ]);
      if (subscriptionError) throw subscriptionError;
      if (billingError) throw billingError;
      if (capabilityError) throw capabilityError;
      const capability = Array.isArray(capabilities)
        ? capabilities[0]
        : capabilities;

      return {
        label,
        result: typeof result === "string" ? result : "processed",
        subscriptionStatus: subscription?.status || null,
        billingState: billing?.state || capability?.billing_state || null,
        firstPaymentConfirmed: Boolean(subscription?.first_payment_confirmed_at),
        canPublish: capability?.can_publish === true,
        canGenerateAi: capability?.can_generate_ai === true
      };
    };

    const projection = await snapshot(
      "subscription_active_before_payment",
      eventIds[0],
      "subscription_active",
      "active",
      iso(-5 * 60 * 1000)
    );
    if (
      projection.firstPaymentConfirmed ||
      projection.canPublish ||
      projection.canGenerateAi
    ) {
      throw new Error("prepayment_cost_gate_failed");
    }

    const paid = await snapshot(
      "first_payment_succeeded",
      eventIds[1],
      "payment_succeeded",
      "active",
      iso(-4 * 60 * 1000)
    );
    if (
      !paid.firstPaymentConfirmed ||
      paid.billingState !== "active" ||
      !paid.canPublish ||
      !paid.canGenerateAi
    ) {
      throw new Error("first_payment_activation_failed");
    }

    const failed = await snapshot(
      "renewal_failed",
      eventIds[2],
      "payment_failed",
      "past_due",
      iso(-3 * 60 * 1000),
      iso(-3 * 60 * 1000)
    );
    if (
      failed.billingState !== "grace" ||
      failed.canGenerateAi ||
      !failed.canPublish
    ) {
      throw new Error("payment_failure_grace_failed");
    }

    const recovered = await snapshot(
      "payment_recovered",
      eventIds[3],
      "payment_succeeded",
      "active",
      iso(-2 * 60 * 1000)
    );
    if (
      recovered.billingState !== "active" ||
      !recovered.firstPaymentConfirmed ||
      !recovered.canPublish ||
      !recovered.canGenerateAi
    ) {
      throw new Error("payment_recovery_failed");
    }

    const canceled = await snapshot(
      "subscription_canceled",
      eventIds[4],
      "subscription_canceled",
      "canceled",
      iso(-1 * 60 * 1000)
    );
    if (
      !canceled.firstPaymentConfirmed ||
      canceled.canPublish ||
      canceled.canGenerateAi
    ) {
      throw new Error("cancellation_cost_gate_failed");
    }

    await cleanup();

    return NextResponse.json({
      ok: cleanupOk,
      mode: "synthetic_provider_lifecycle",
      checkoutEnabled: false,
      cleanupOk,
      steps: [projection, paid, failed, recovered, canceled]
    }, { status: cleanupOk ? 200 : 503 });
  } catch (error) {
    await cleanup();
    console.error("ELTARA billing lifecycle smoke failed", {
      code: error instanceof Error ? error.message : "unknown",
      cleanupOk
    });
    return NextResponse.json(
      {
        ok: false,
        code: error instanceof Error ? error.message : "unknown",
        cleanupOk
      },
      { status: 503 }
    );
  }
}
