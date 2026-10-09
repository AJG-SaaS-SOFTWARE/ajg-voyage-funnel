import { NextRequest, NextResponse } from "next/server";
import { releaseE2EAuthorized } from "../../../../lib/release-e2e-auth";
import { runStripeSandboxAiLaunchCheckoutSmoke, runStripeSandboxCheckoutSmoke } from "../../../../lib/stripe-billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!releaseE2EAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.AJG_BILLING_CHECKOUT_ENABLED?.trim().toLowerCase() === "true") {
    return NextResponse.json(
      { error: "Sandbox smoke is disabled while commercial Checkout is open." },
      { status: 409 }
    );
  }

  const priceId = process.env.STRIPE_ESSENTIAL_MONTHLY_PRICE_ID?.trim() || "";
  const aiLaunchPriceId = process.env.STRIPE_AI_LAUNCH_PRICE_ID?.trim() || "";
  if (!priceId || !aiLaunchPriceId) {
    return NextResponse.json({ error: "Stripe sandbox prices are not configured." }, { status: 503 });
  }

  const origin = (
    process.env.NEXT_PUBLIC_APP_URL ||
    request.nextUrl.origin
  ).replace(/\/$/, "");

  try {
    const [subscription, aiLaunch] = await Promise.all([
      runStripeSandboxCheckoutSmoke({
        priceId,
        successUrl: `${origin}/billing?stripeSmoke=success`,
        cancelUrl: `${origin}/plans?stripeSmoke=cancel`
      }),
      runStripeSandboxAiLaunchCheckoutSmoke({
        priceId: aiLaunchPriceId,
        successUrl: `${origin}/billing?aiLaunchSmoke=success`,
        cancelUrl: `${origin}/plans?aiLaunchSmoke=cancel`
      })
    ]);

    return NextResponse.json({
      ok: subscription.ok && aiLaunch.ok,
      mode: subscription.mode,
      created: subscription.created,
      expired: subscription.expired,
      aiLaunchCreated: aiLaunch.created,
      aiLaunchExpired: aiLaunch.expired,
      checkoutEnabled: false
    });
  } catch (error) {
    console.error("ELTARA Stripe sandbox mutation smoke failed", {
      code: error instanceof Error ? error.message : "unknown"
    });

    return NextResponse.json(
      {
        ok: false,
        code: error instanceof Error ? error.message : "unknown"
      },
      { status: 503 }
    );
  }
}
