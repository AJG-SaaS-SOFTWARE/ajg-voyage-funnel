import { NextResponse } from "next/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { appBaseUrl } from "../../../../lib/app-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearer(request: Request) {
  const value = request.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

function member(user: User) {
  return {
    id: user.id,
    email: user.email || "",
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at || null,
    invitedAt:
      typeof user.app_metadata?.beta_invited_at === "string"
        ? user.app_metadata.beta_invited_at
        : null
  };
}

type AdminContext =
  | { ok: false; response: NextResponse }
  | { ok: true; service: SupabaseClient };

async function requireAdmin(request: Request): Promise<AdminContext> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !publishable || !serviceKey) {
    return { ok: false, response: NextResponse.json({ error: "Admin unavailable" }, { status: 503 }) };
  }

  const token = bearer(request);
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const userClient = createClient(url, publishable, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const {
    data: { user },
    error: userError
  } = await userClient.auth.getUser(token);

  if (userError || !user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: role, error: roleError } = await userClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleError || role?.role !== "admin") {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  return { ok: true, service };
}

async function listBetaUsers(service: SupabaseClient) {
  const { data, error } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return (data.users || []).filter((user) => user.app_metadata?.ajg_beta === true);
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const users = await listBetaUsers(auth.service);
    return NextResponse.json(
      {
        limit: 25,
        members: users
          .map(member)
          .sort((a, b) => (b.invitedAt || b.createdAt).localeCompare(a.invitedAt || a.createdAt))
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "Cohorte bêta indisponible" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Adresse e-mail invalide" }, { status: 400 });
  }

  try {
    const { data: allUsers, error: listError } = await auth.service.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });
    if (listError) throw listError;

    const betaUsers = (allUsers.users || []).filter(
      (user) => user.app_metadata?.ajg_beta === true
    );
    const existing = (allUsers.users || []).find(
      (user) => user.email?.toLowerCase() === email
    );

    if (!existing && betaUsers.length >= 25) {
      return NextResponse.json(
        { error: "La cohorte bêta est limitée à 25 comptes." },
        { status: 409 }
      );
    }

    const invitedAt =
      existing && typeof existing.app_metadata?.beta_invited_at === "string"
        ? existing.app_metadata.beta_invited_at
        : new Date().toISOString();

    if (existing) {
      const { data, error } = await auth.service.auth.admin.updateUserById(existing.id, {
        app_metadata: {
          ...existing.app_metadata,
          ajg_beta: true,
          beta_invited_at: invitedAt,
          beta_source: "admin"
        }
      });
      if (error || !data.user) throw error || new Error("user_update_failed");

      return NextResponse.json({
        invited: false,
        existing: true,
        member: member(data.user)
      });
    }

    const { data: invite, error: inviteError } =
      await auth.service.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${appBaseUrl()}/builder`,
        data: { beta_invitation: true }
      });

    if (inviteError || !invite.user) {
      throw inviteError || new Error("invite_failed");
    }

    const { data: updated, error: updateError } =
      await auth.service.auth.admin.updateUserById(invite.user.id, {
        app_metadata: {
          ...invite.user.app_metadata,
          ajg_beta: true,
          beta_invited_at: invitedAt,
          beta_source: "admin"
        }
      });

    if (updateError || !updated.user) {
      throw updateError || new Error("invite_metadata_failed");
    }

    return NextResponse.json(
      {
        invited: true,
        existing: false,
        member: member(updated.user)
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invitation bêta impossible",
        detail: error instanceof Error ? error.message : "unknown"
      },
      { status: 502 }
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  if (!userId) {
    return NextResponse.json({ error: "Utilisateur requis" }, { status: 400 });
  }

  try {
    const { data: current, error: readError } =
      await auth.service.auth.admin.getUserById(userId);
    if (readError || !current.user) throw readError || new Error("user_not_found");

    const { error } = await auth.service.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...current.user.app_metadata,
        ajg_beta: false,
        beta_removed_at: new Date().toISOString()
      }
    });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Retrait de la cohorte impossible" }, { status: 502 });
  }
}
