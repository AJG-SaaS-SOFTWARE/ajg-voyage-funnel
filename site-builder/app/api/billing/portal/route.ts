import { NextResponse } from "next/server";
import {
  billingAppUrl,
  billingServiceClient,
  billingUserContext,
  ownedBillingSite
} from "../../../../lib/server-billing";
import { createStripePortalSession } from "../../../../lib/stripe-billing";

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

  const service = billingServiceClient();
  if (!service) {
    return NextResponse.json({ error: "La facturation serveur n’est pas configurée." }, { status: 503 });
  }

  const { data: subscription, error } = await service
    .from("site_subscriptions")
    .select("provider,provider_customer_id")
    .eq("site_id", site.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Impossible de vérifier votre compte de facturation." }, { status: 503 });
  }

  if (subscription?.provider !== "stripe" || !subscription.provider_customer_id) {
    return NextResponse.json(
      {
        error:
          "Aucun compte Stripe n’est encore rattaché à ce site. Lancez d’abord la souscription Pro."
      },
      { status: 409 }
    );
  }

  try {
    const session = await createStripePortalSession({
      customerId: subscription.provider_customer_id,
      returnUrl: `${billingAppUrl(request)}/billing?siteId=${encodeURIComponent(site.id)}`
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe Portal session creation failed", {
      code: error instanceof Error ? error.message : "unknown"
    });
    return NextResponse.json(
      { error: "Impossible d’ouvrir le portail Stripe pour le moment." },
      { status: 502 }
    );
  }
}
