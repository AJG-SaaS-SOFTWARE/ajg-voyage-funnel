import { NextResponse } from "next/server";
import {
  billingAppUrl,
  billingServiceClient,
  billingUserContext,
  ownedBillingSite
} from "../../../../lib/server-billing";
import { createStripePortalSession } from "../../../../lib/stripe-billing";
import { localize, requestProductLocale } from "../../../../lib/server-locale";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const locale = requestProductLocale(request);
  const tr = (fr: string, en: string) => localize(locale, fr, en);
  const auth = await billingUserContext(request);
  if (!auth) {
    return NextResponse.json({ error: tr("Reconnectez-vous pour gérer votre abonnement.", "Sign in again to manage your subscription.") }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const siteId = typeof body?.siteId === "string" ? body.siteId : "";
  if (!siteId) {
    return NextResponse.json({ error: tr("Le site concerné doit être identifié.", "The website must be identified.") }, { status: 400 });
  }

  const site = await ownedBillingSite(auth.client, auth.user.id, siteId).catch(() => null);
  if (!site) {
    return NextResponse.json({ error: tr("Site introuvable.", "Website not found.") }, { status: 404 });
  }

  const service = billingServiceClient();
  if (!service) {
    return NextResponse.json({ error: tr("La facturation serveur n’est pas configurée.", "Server-side billing is not configured.") }, { status: 503 });
  }

  const { data: subscription, error } = await service
    .from("site_subscriptions")
    .select("provider,provider_customer_id")
    .eq("site_id", site.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: tr("Impossible de vérifier votre compte de facturation.", "Unable to verify your billing account.") }, { status: 503 });
  }

  if (subscription?.provider !== "stripe" || !subscription.provider_customer_id) {
    return NextResponse.json(
      {
        error:
          tr("Aucun compte Stripe n’est encore rattaché à ce site. Lancez d’abord la souscription Pro.", "No Stripe account is linked to this website yet. Start the Pro subscription first.")
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
      { error: tr("Impossible d’ouvrir le portail Stripe pour le moment.", "Unable to open the Stripe portal right now.") },
      { status: 502 }
    );
  }
}
