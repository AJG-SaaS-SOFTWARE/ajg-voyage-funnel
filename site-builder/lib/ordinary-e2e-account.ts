import type { SupabaseClient, User } from "@supabase/supabase-js";

// Credentials remain inside the recipe. Never return them in HTTP results or journals.
export function ordinaryE2EAccount(service: SupabaseClient, client: SupabaseClient) {
  let userId = "";
  let signedIn = false;
  return {
    async provision(): Promise<{ user: User; token: string; client: SupabaseClient }> {
      const suffix = crypto.randomUUID().replace(/-/g, "");
      const email = `customer-e2e-${suffix}@example.invalid`;
      const password = crypto.randomUUID() + crypto.randomUUID();
      const { data, error } = await service.auth.admin.createUser({
        email, password, email_confirm: true,
        app_metadata: { purpose: "eltara_ordinary_customer_e2e", attempt_id: suffix }
      });
      if (error || !data.user) throw new Error("ordinary_account_creation_failed");
      userId = data.user.id;
      const session = await client.auth.signInWithPassword({ email, password });
      signedIn = Boolean(session.data.session);
      const user = session.data.user;
      const token = session.data.session?.access_token;
      if (session.error || !user || user.id !== userId || !token) {
        throw new Error("ordinary_account_sign_in_failed");
      }
      const [role, beta] = await Promise.all([
        client.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
        client.rpc("get_my_beta_access")
      ]);
      const betaRow = Array.isArray(beta.data) ? beta.data[0] : beta.data;
      if (role.error || beta.error || role.data?.role === "admin" ||
          !(Array.isArray(beta.data) && beta.data.length === 0) && betaRow?.active !== false) {
        throw new Error("ordinary_account_privileges_unconfirmed");
      }
      return { user, token, client };
    },
    async cleanup(options?: { preserveAccount?: boolean }): Promise<boolean> {
      let ok = true;
      if (signedIn) {
        try { if ((await client.auth.signOut({ scope: "global" })).error) ok = false; }
        catch { ok = false; }
      }
      if (userId && !options?.preserveAccount) {
        try { if ((await service.auth.admin.deleteUser(userId)).error) ok = false; }
        catch { ok = false; }
      }
      return ok;
    }
  };
}
