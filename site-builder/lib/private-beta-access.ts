import { getSupabaseBrowserClient } from "./supabase-browser";

export type PrivateBetaAccess = {
  authenticated: boolean;
  allowed: boolean;
  betaActive: boolean;
  admin: boolean;
  expiresAt: string | null;
};

export async function getPrivateBetaAccess(): Promise<PrivateBetaAccess> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return {
      authenticated: false,
      allowed: false,
      betaActive: false,
      admin: false,
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
      expiresAt: null
    };
  }

  const [betaResult, roleResult] = await Promise.all([
    supabase.rpc("get_my_beta_access"),
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle()
  ]);

  const betaRow = Array.isArray(betaResult.data)
    ? betaResult.data[0]
    : betaResult.data;
  const betaActive = betaResult.error ? false : betaRow?.active === true;
  const admin = roleResult.error ? false : roleResult.data?.role === "admin";

  return {
    authenticated: true,
    allowed: betaActive || admin,
    betaActive,
    admin,
    expiresAt: betaRow?.expires_at || null
  };
}
