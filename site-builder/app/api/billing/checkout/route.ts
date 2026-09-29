import { NextResponse } from "next/server";
import {
  billingAppUrl,
  billingServiceClient,
  billingUserContext,
  ownedBillingSite
} from "../../../../lib/server-billing";
import { createStripeSubscriptionCheckout } from "../../../../lib/stripe-billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await billingUserContext(request);
  if (!auth) {
    return NextResponse.json({ error: "Reconnectez-vous pour gérer votre abonnement." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const siteId = typeof body?.siteId === "string" ? body.siteId : "";
  if (!siteId) {
    return NextResponse.json({ error: "Le site concerné doit être identifié." }, { status: 400 });
  }

  const site = await ownedBillingSite(auth.client, auth.user.id, siteId).catch(() => null);
  if (!site) {
    return NextResponse.json({ error: "Site introuvable." }, { status: 404 });
  }

  const priceId = process.env.STRIPE_PRO_PRICE_ID?.trim() || "";
  if (!priceId) {
    return NextResponse.json(
      { error: "Le tarif Pro Stripe n’est pas encore activé sur cet environnement." },
      { status: 503 }
    );
  }

  const service = billingServiceClient();
  if (!service) {
    return NextResponse.json({ error: "La facturation serveur n’est pas configurée." }, { status: 503 });
  }

  const { data: current, error: currentError } = await service
    .from("site_subscriptions")
    .select("plan_key,status,provider,provider_customer_id,provider_subscription_id")
    .eq("site_id", site.id)
    .maybeSingle();

  if (currentError) {
    return NextResponse.json({ error: "Impossible de vérifier l’abonnement actuel." }, { status: 503 });
  }

  if (
    current?.provider === "stripe" &&
    current.provider_subscription_id &&
    ["active", "trialing", "past_due"].includes(current.status)
  ) {
    return NextResponse.json(
      {
        error:
          "Un abonnement Stripe existe déjà pour ce site. Utilisez l’espace de facturation pour le gérer.",
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
      successUrl: `${appUrl}/billing?checkout=success&siteId=${encodeURIComponent(site.id)}`,
      cancelUrl: `${appUrl}/plans?checkout=cancel&siteId=${encodeURIComponent(site.id)}`
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe n’a pas renvoyé de page de paiement." }, { status: 502 });
    }

    return NextResponse.json({ url: session.url, checkoutSessionId: session.id });
  } catch (error) {
    console.error("Stripe Checkout session creation failed", {
      code: error instanceof Error ? error.message : "unknown"
    });
    return NextResponse.json(
      { error: "Impossible d’ouvrir le paiement Stripe pour le moment." },
      { status: 502 }
    );
  }
}
