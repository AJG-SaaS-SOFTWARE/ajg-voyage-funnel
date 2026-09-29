import { createClient } from "@supabase/supabase-js";

function supabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}

function publicKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  );
}

function serviceKey() {
  return (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
}

export function billingServiceClient() {
  const url = supabaseUrl();
  const key = serviceKey();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function billingUserContext(request: Request) {
  const url = supabaseUrl();
  const key = publicKey();
  const token =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";

  if (!url || !key || !token) return null;

  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const {
    data: { user },
    error
  } = await client.auth.getUser(token);

  return error || !user ? null : { user, client };
}

export function billingAppUrl(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:" || url.hostname === "localhost") {
        return url.origin;
      }
    } catch {
      // Fall back to the request origin below.
    }
  }
  return new URL(request.url).origin;
}

export async function ownedBillingSite(
  userClient: any,
  userId: string,
  siteId: string
) {
  const { data, error } = await userClient
    .from("sites")
    .select("id,owner_id,slug")
    .eq("id", siteId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}
