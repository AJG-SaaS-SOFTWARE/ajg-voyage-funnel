import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { releaseE2EAuthorized } from "../../../../lib/release-e2e-auth";
import { stripeCredentialMode } from "../../../../lib/stripe-billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function signedStripeHeader(payload: string, secret: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`, "utf8")
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

export async function GET(request: NextRequest) {
  if (!releaseE2EAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.AJG_BILLING_CHECKOUT_ENABLED?.trim().toLowerCase() === "true") {
    return NextResponse.json(
      { error: "AI Launch webhook smoke is disabled while commercial Checkout is open." },
      { status: 409 }
    );
  }

  if (stripeCredentialMode() !== "test") {
    return NextResponse.json({ error: "Stripe sandbox is required." }, { status: 409 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || "";
  const growthPriceId = process.env.STRIPE_GROWTH_MONTHLY_PRICE_ID?.trim() || "";
  const origin = (
    process.env.NEXT_PUBLIC_APP_URL ||
    request.nextUrl.origin
  ).replace(/\/$/, "");

  if (!url || !serviceKey || !webhookSecret || !growthPriceId) {
    return NextResponse.json(
      { error: "AI Launch webhook smoke is not configured." },
      { status: 503 }
    );
  }

  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const email = `ai-launch-webhook-e2e-${suffix}@example.invalid`;
  const eventId = `billing-ai-launch-e2e-${suffix}-paid`;
  let userId = "";
  let siteId = "";
  let cleanupOk = true;

  const sendPaidAiLaunch = async (sessionSuffix: string) => {
    const event = {
      id: `evt_ai_launch_e2e_${sessionSuffix}`,
      object: "event",
      type: "checkout.session.completed",
      livemode: false,
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: `cs_test_ai_launch_e2e_${sessionSuffix}`,
          object: "checkout.session",
          mode: "payment",
          payment_status: "paid",
          client_reference_id: siteId,
          subscription: null,
          metadata: {
            app: "ajg_site_builder",
            site_id: siteId,
            owner_id: userId,
            purchase_type: "ai_launch"
          }
        }
      }
    };
    const payload = JSON.stringify(event);
    const response = await fetch(`${origin}/api/billing/stripe-webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": signedStripeHeader(payload, webhookSecret)
      },
      body: payload,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000)
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        typeof body?.error === "string"
          ? body.error
          : `webhook_http_${response.status}`
      );
    }
    return body;
  };

  const entitlementCount = async () => {
    const { count, error } = await service
      .from("site_ai_launch_entitlements")
      .select("id", { count: "exact", head: true })
      .eq("site_id", siteId)
      .eq("owner_id", userId)
      .eq("source", "stripe_purchase")
      .eq("status", "active");
    if (error) throw error;
    return count || 0;
  };

  const cleanup = async () => {
    const { error: providerEventCleanupError } = await service
      .from("billing_provider_events")
      .delete()
      .eq("provider", "stripe_e2e")
      .eq("event_id", eventId);
    if (providerEventCleanupError) cleanupOk = false;

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
        email_confirm: true,
        user_metadata: { purpose: "eltara_ai_launch_webhook_e2e" }
      });
    if (createError || !created.user) {
      throw createError || new Error("temporary_user_creation_failed");
    }
    userId = created.user.id;

    const { data: site, error: siteError } = await service
      .from("sites")
      .insert({
        owner_id: userId,
        slug: `ai-launch-e2e-${suffix}`,
        status: "draft",
        primary_language: "fr",
        enabled_languages: ["fr"],
        brand_name: "ELTARA AI Launch E2E",
        first_name: "AI",
        last_name: "Launch",
        hero_title: "ELTARA AI Launch E2E",
        hero_subtitle: "Temporary signed Stripe webhook validation.",
        hero_tagline: "E2E",
        about_heading: "Validation",
        about_text: "Temporary signed Stripe webhook validation.",
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

    const unpaidResponse = await sendPaidAiLaunch(`${suffix}_unpaid`);
    if (
      unpaidResponse?.result !== "subscription_required" ||
      (await entitlementCount()) !== 0
    ) {
      throw new Error("unpaid_ai_launch_webhook_gate_failed");
    }

    const providerCreatedAt = new Date(Date.now() - 60_000).toISOString();
    const { data: billingResult, error: billingError } = await service.rpc(
      "apply_builder_site_billing_provider_event_v2",
      {
        p_provider: "stripe_e2e",
        p_event_id: eventId,
        p_event_type: "payment_succeeded",
        p_site_id: siteId,
        p_owner_id: userId,
        p_plan_key: "growth",
        p_provider_customer_id: `cus_e2e_${suffix}`,
        p_provider_subscription_id: `sub_e2e_${suffix}`,
        p_provider_price_id: growthPriceId,
        p_provider_status: "active",
        p_paid_through: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
        p_failed_at: null,
        p_provider_created_at: providerCreatedAt
      }
    );
    if (billingError || billingResult !== "reactivated") {
      throw billingError || new Error("paid_subscription_fixture_failed");
    }

    const paidResponse = await sendPaidAiLaunch(`${suffix}_paid`);
    if (
      paidResponse?.result !== "granted" ||
      (await entitlementCount()) !== 1
    ) {
      throw new Error("paid_ai_launch_webhook_grant_failed");
    }

    await cleanup();

    return NextResponse.json(
      {
        ok: cleanupOk,
        mode: "signed_ai_launch_webhook",
        checkoutEnabled: false,
        sandbox: true,
        unpaidBlocked: true,
        paidGranted: true,
        cleanupOk
      },
      { status: cleanupOk ? 200 : 503 }
    );
  } catch (error) {
    await cleanup();
    console.error("ELTARA AI Launch webhook smoke failed", {
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
