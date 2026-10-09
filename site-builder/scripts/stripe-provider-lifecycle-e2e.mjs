const STRIPE_API = "https://api.stripe.com/v1";
const STRIPE_VERSION = "2026-08-26.dahlia";

const baseUrl = (process.env.ELTARA_E2E_BASE_URL || "").replace(/\/$/, "");
const releaseToken = process.env.AJG_RELEASE_E2E_TOKEN || "";
const stripeKey = process.env.STRIPE_PROVIDER_E2E_KEY || "";

if (!baseUrl || !releaseToken || !stripeKey) {
  throw new Error("provider_billing_e2e_not_configured");
}
if (!stripeKey.startsWith("rk_test_") && !stripeKey.startsWith("sk_test_")) {
  throw new Error("provider_billing_e2e_requires_test_key");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function appendForm(form, key, value) {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => appendForm(form, `${key}[${index}]`, item));
    return;
  }
  if (typeof value === "object") {
    for (const [childKey, childValue] of Object.entries(value)) {
      appendForm(form, `${key}[${childKey}]`, childValue);
    }
    return;
  }
  form.append(key, String(value));
}

async function stripe(path, { method = "POST", params = {} } = {}) {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) appendForm(form, key, value);
  const query = method === "GET" && form.size ? `?${form.toString()}` : "";
  const response = await fetch(`${STRIPE_API}${path}${query}`, {
    method,
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Stripe-Version": STRIPE_VERSION,
      ...(method === "GET" ? {} : { "Content-Type": "application/x-www-form-urlencoded" })
    },
    body: method === "GET" ? undefined : form.toString()
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = data?.error?.code || data?.error?.type || `stripe_http_${response.status}`;
    throw new Error(code);
  }
  return data;
}

async function harness(action, payload = {}) {
  const response = await fetch(`${baseUrl}/api/cron/stripe-provider-lifecycle-harness`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${releaseToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ action, ...payload })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `harness_http_${response.status}`);
  }
  return data;
}

async function poll(label, check, timeoutMs = 120000, intervalMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await check();
    if (last?.ok) return last.value;
    await sleep(intervalMs);
  }
  throw new Error(`${label}_timeout`);
}

async function attachPaymentMethod(paymentMethod, customer) {
  return stripe(`/payment_methods/${encodeURIComponent(paymentMethod)}/attach`, {
    params: { customer }
  });
}

async function setCustomerPaymentMethod(customer, paymentMethod) {
  return stripe(`/customers/${encodeURIComponent(customer)}`, {
    params: {
      invoice_settings: { default_payment_method: paymentMethod }
    }
  });
}

async function setSubscriptionPaymentMethod(subscription, paymentMethod) {
  return stripe(`/subscriptions/${encodeURIComponent(subscription)}`, {
    params: {
      default_payment_method: paymentMethod,
      proration_behavior: "none"
    }
  });
}

async function waitClockReady(clockId) {
  return poll("stripe_test_clock_ready", async () => {
    const clock = await stripe(
      `/test_helpers/test_clocks/${encodeURIComponent(clockId)}`,
      { method: "GET" }
    );
    return { ok: clock?.status === "ready", value: clock };
  }, 180000, 2500);
}

const fixture = { attemptId: "", ownerId: "", siteId: "" };
let clockId = "";
let customerId = "";
let subscriptionId = "";
let cleanupOk = true;

try {
  const provisioned = await harness("provision");
  fixture.attemptId = provisioned.attemptId;
  fixture.ownerId = provisioned.ownerId;
  fixture.siteId = provisioned.siteId;
  const growthPriceId = provisioned.growthMonthlyPriceId;

  if (
    provisioned?.sandbox !== true ||
    provisioned?.checkoutEnabled !== false ||
    typeof growthPriceId !== "string" ||
    !growthPriceId.startsWith("price_")
  ) {
    throw new Error("provider_billing_fixture_invalid");
  }

  const now = Math.floor(Date.now() / 1000);
  const clock = await stripe("/test_helpers/test_clocks", {
    params: {
      frozen_time: now,
      name: `ELTARA provider E2E ${fixture.attemptId.slice(0, 8)}`
    }
  });
  clockId = clock.id;
  if (!clockId || clock.livemode !== false) {
    throw new Error("provider_billing_clock_invalid");
  }

  const customer = await stripe("/customers", {
    params: {
      email: `provider-e2e-${fixture.attemptId.slice(0, 12)}@example.invalid`,
      test_clock: clockId,
      metadata: {
        app: "ajg_site_builder",
        purpose: "provider_billing_e2e",
        site_id: fixture.siteId,
        owner_id: fixture.ownerId
      }
    }
  });
  customerId = customer.id;
  if (!customerId || customer.livemode !== false) {
    throw new Error("provider_billing_customer_invalid");
  }

  const goodPaymentMethod = "pm_card_visa";
  const failedPaymentMethod = "pm_card_chargeCustomerFail";

  await attachPaymentMethod(goodPaymentMethod, customerId);
  await setCustomerPaymentMethod(customerId, goodPaymentMethod);

  const subscription = await stripe("/subscriptions", {
    params: {
      customer: customerId,
      items: [{ price: growthPriceId, quantity: 1 }],
      default_payment_method: goodPaymentMethod,
      payment_behavior: "error_if_incomplete",
      metadata: {
        app: "ajg_site_builder",
        purpose: "provider_billing_e2e",
        site_id: fixture.siteId,
        owner_id: fixture.ownerId,
        plan_key: "growth"
      }
    }
  });
  subscriptionId = subscription.id;
  if (!subscriptionId || subscription.livemode !== false) {
    throw new Error("provider_billing_subscription_invalid");
  }

  await poll("provider_initial_payment", async () => {
    const state = await harness("status", fixture);
    const ok =
      state?.subscription?.provider === "stripe" &&
      state?.subscription?.status === "active" &&
      state?.subscription?.firstPaymentConfirmed === true &&
      state?.billing?.state === "active";
    return { ok, value: state };
  }, 120000, 2000);

  await attachPaymentMethod(failedPaymentMethod, customerId);
  await setCustomerPaymentMethod(customerId, failedPaymentMethod);
  await setSubscriptionPaymentMethod(subscriptionId, failedPaymentMethod);

  await stripe(`/test_helpers/test_clocks/${encodeURIComponent(clockId)}/advance`, {
    params: {
      frozen_time: now + 35 * 24 * 60 * 60
    }
  });
  await waitClockReady(clockId);

  await poll("provider_renewal_failure", async () => {
    const state = await harness("status", fixture);
    const ok =
      state?.billing?.state === "grace" &&
      state?.billing?.hasFailure === true;
    return { ok, value: state };
  }, 180000, 2500);

  await setCustomerPaymentMethod(customerId, goodPaymentMethod);
  await setSubscriptionPaymentMethod(subscriptionId, goodPaymentMethod);

  const invoices = await stripe("/invoices", {
    method: "GET",
    params: { customer: customerId, limit: 10 }
  });
  const failedInvoice = Array.isArray(invoices?.data)
    ? invoices.data.find((invoice) =>
        invoice?.status === "open" &&
        (invoice?.subscription === subscriptionId ||
          invoice?.parent?.subscription_details?.subscription === subscriptionId)
      )
    : null;
  if (!failedInvoice?.id) {
    throw new Error("provider_failed_invoice_not_found");
  }

  await stripe(`/invoices/${encodeURIComponent(failedInvoice.id)}/pay`);

  await poll("provider_payment_recovery", async () => {
    const state = await harness("status", fixture);
    const ok =
      state?.billing?.state === "active" &&
      state?.subscription?.status === "active" &&
      state?.subscription?.firstPaymentConfirmed === true;
    return { ok, value: state };
  }, 120000, 2000);

  await stripe(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: "DELETE",
    params: {
      invoice_now: false,
      prorate: false
    }
  });

  await poll("provider_subscription_cancellation", async () => {
    const state = await harness("status", fixture);
    const ok = state?.subscription?.status === "canceled";
    return { ok, value: state };
  }, 120000, 2000);

  console.log(JSON.stringify({
    ok: true,
    mode: "provider_backed_stripe_lifecycle",
    initialPayment: true,
    renewalFailure: true,
    recovery: true,
    cancellation: true,
    checkoutEnabled: false,
    sandbox: true
  }));
} finally {
  if (clockId) {
    try {
      await stripe(`/test_helpers/test_clocks/${encodeURIComponent(clockId)}`, {
        method: "DELETE"
      });
    } catch {
      cleanupOk = false;
      if (subscriptionId) {
        await stripe(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {
          method: "DELETE",
          params: { invoice_now: false, prorate: false }
        }).catch(() => undefined);
      }
      if (customerId) {
        await stripe(`/customers/${encodeURIComponent(customerId)}`, {
          method: "DELETE"
        }).catch(() => undefined);
      }
    }
  }

  if (fixture.siteId && fixture.ownerId && fixture.attemptId) {
    try {
      await harness("cleanup", fixture);
    } catch {
      cleanupOk = false;
    }
  }

  if (!cleanupOk) {
    console.error("provider_billing_e2e_cleanup_incomplete");
    process.exitCode = 1;
  }
}
