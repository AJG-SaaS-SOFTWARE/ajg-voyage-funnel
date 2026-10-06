import { stripeRequest } from "./stripe-billing";

type ExpectedPrice = {
  env: string;
  label: string;
  amount: number;
  type: "recurring" | "one_time";
  interval?: "month" | "year";
};

type StripePriceSnapshot = {
  id?: string;
  active?: boolean;
  currency?: string;
  type?: string;
  unit_amount?: number | null;
  recurring?: { interval?: string } | null;
  product?: string | {
    active?: boolean;
    metadata?: Record<string, string>;
    name?: string;
  };
};

type StripePortalSnapshot = {
  id?: string;
  active?: boolean;
  metadata?: Record<string, string>;
  features?: {
    payment_method_update?: { enabled?: boolean };
    invoice_history?: { enabled?: boolean };
    subscription_cancel?: { enabled?: boolean; mode?: string };
    subscription_update?: { enabled?: boolean };
  };
};

export type StripeRuntimeAuditItem = {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
};

const EXPECTED_PRICES: ExpectedPrice[] = [
  {
    env: "STRIPE_ESSENTIAL_MONTHLY_PRICE_ID",
    label: "Essentiel mensuel",
    amount: 1500,
    type: "recurring",
    interval: "month"
  },
  {
    env: "STRIPE_ESSENTIAL_ANNUAL_PRICE_ID",
    label: "Essentiel annuel",
    amount: 15000,
    type: "recurring",
    interval: "year"
  },
  {
    env: "STRIPE_GROWTH_MONTHLY_PRICE_ID",
    label: "Growth mensuel",
    amount: 2900,
    type: "recurring",
    interval: "month"
  },
  {
    env: "STRIPE_GROWTH_ANNUAL_PRICE_ID",
    label: "Growth annuel",
    amount: 29000,
    type: "recurring",
    interval: "year"
  },
  {
    env: "STRIPE_AI_LAUNCH_PRICE_ID",
    label: "Création IA",
    amount: 4900,
    type: "one_time"
  }
];

function validatePrice(
  expected: ExpectedPrice,
  price: StripePriceSnapshot
): StripeRuntimeAuditItem {
  const product =
    price.product && typeof price.product === "object" ? price.product : null;
  const checks = [
    price.active === true,
    price.currency === "eur",
    price.unit_amount === expected.amount,
    price.type === expected.type,
    expected.type === "one_time"
      ? !price.recurring
      : price.recurring?.interval === expected.interval,
    product?.active === true,
    product?.metadata?.app === "ajg_site_builder"
  ];
  const ok = checks.every(Boolean);

  return {
    key: `stripe-price-${expected.env.toLowerCase()}`,
    label: `Stripe · ${expected.label}`,
    ok,
    detail: ok
      ? `${expected.label} validé côté Stripe (${(expected.amount / 100).toFixed(2)} €).`
      : `${expected.label} ne correspond pas au contrat ELTARA attendu.`
  };
}

export async function auditStripeRuntime(): Promise<StripeRuntimeAuditItem[]> {
  const items: StripeRuntimeAuditItem[] = [];

  for (const expected of EXPECTED_PRICES) {
    const priceId = process.env[expected.env]?.trim();
    if (!priceId) {
      items.push({
        key: `stripe-price-${expected.env.toLowerCase()}`,
        label: `Stripe · ${expected.label}`,
        ok: false,
        detail: `${expected.env} manquant.`
      });
      continue;
    }

    try {
      const price = await stripeRequest<StripePriceSnapshot>(
        `/prices/${encodeURIComponent(priceId)}`,
        { method: "GET", params: { expand: ["product"] } }
      );
      items.push(validatePrice(expected, price));
    } catch {
      items.push({
        key: `stripe-price-${expected.env.toLowerCase()}`,
        label: `Stripe · ${expected.label}`,
        ok: false,
        detail: `${expected.label} inaccessible avec la clé Stripe configurée.`
      });
    }
  }

  const portalId = process.env.STRIPE_PORTAL_CONFIGURATION_ID?.trim();
  if (!portalId) {
    items.push({
      key: "stripe-portal-runtime",
      label: "Stripe · Customer Portal",
      ok: false,
      detail: "STRIPE_PORTAL_CONFIGURATION_ID manquant."
    });
    return items;
  }

  try {
    const portal = await stripeRequest<StripePortalSnapshot>(
      `/billing_portal/configurations/${encodeURIComponent(portalId)}`,
      { method: "GET" }
    );
    const ok =
      portal.active === true &&
      portal.metadata?.app === "ajg_site_builder" &&
      portal.features?.payment_method_update?.enabled === true &&
      portal.features?.invoice_history?.enabled === true &&
      portal.features?.subscription_cancel?.enabled === true &&
      portal.features?.subscription_cancel?.mode === "at_period_end" &&
      portal.features?.subscription_update?.enabled === true;

    items.push({
      key: "stripe-portal-runtime",
      label: "Stripe · Customer Portal",
      ok,
      detail: ok
        ? "Customer Portal ELTARA actif, modification et résiliation en fin de période validées."
        : "La configuration Customer Portal ne correspond pas au contrat ELTARA attendu."
    });
  } catch {
    items.push({
      key: "stripe-portal-runtime",
      label: "Stripe · Customer Portal",
      ok: false,
      detail: "Customer Portal inaccessible avec la clé Stripe configurée."
    });
  }

  return items;
}
