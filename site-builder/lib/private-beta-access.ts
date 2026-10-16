import { getSupabaseBrowserClient } from "./supabase-browser";

export type PrivateBetaAccess = {
  authenticated: boolean;
  allowed: boolean;
  betaActive: boolean;
  admin: boolean;
  paidCustomer: boolean;
  expiresAt: string | null;
};

export async function getPrivateBetaAccess(): Promise<PrivateBetaAccess> {
  return getPrivateBetaAccessForClient(getSupabaseBrowserClient());
}

export async function getPrivateBetaAccessForClient(
  supabase: ReturnType<typeof getSupabaseBrowserClient>
): Promise<PrivateBetaAccess> {
  if (!supabase) {
    return {
      authenticated: false,
      allowed: false,
      betaActive: false,
      admin: false,
      paidCustomer: false,
      expiresAt: null
    };
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      authenticated: false,
      allowed: false,
      betaActive: false,
      admin: false,
      paidCustomer: false,
      expiresAt: null
    };
  }

  const [betaResult, roleResult, subscriptionResult] = await Promise.all([
    supabase.rpc("get_my_beta_access"),
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("site_subscriptions")
      .select("owner_id,plan_key,status,first_payment_confirmed_at")
      .eq("owner_id", user.id)
      .limit(100)
  ]);

  const betaRow = Array.isArray(betaResult.data)
    ? betaResult.data[0]
    : betaResult.data;
  const betaActive = betaResult.error ? false : betaRow?.active === true;
  const admin = roleResult.error ? false : roleResult.data?.role === "admin";

  // Entry to the editor is separate from paid feature authorization. Server
  // publication/AI/billing guards still enforce suspension and quotas.
  const paidCustomer = !subscriptionResult.error && Array.isArray(subscriptionResult.data) &&
    subscriptionResult.data.some(subscription => {
      const paidAt = Date.parse(subscription.first_payment_confirmed_at || "");
      return subscription.owner_id === user.id &&
        ["essential", "growth"].includes(subscription.plan_key) &&
        ["active", "past_due"].includes(subscription.status) &&
        Number.isFinite(paidAt) && paidAt <= Date.now();
    });

  return {
    authenticated: true,
    allowed: betaActive || admin || paidCustomer,
    betaActive,
    admin,
    paidCustomer,
    expiresAt: betaRow?.expires_at || null
  };
}
