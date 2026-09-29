import { NextResponse } from "next/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { appBaseUrl } from "../../../../lib/app-url";
import { evaluatePrivateBetaGate } from "../../../../lib/private-beta-gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearer(request: Request) {
  const value = request.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

type BetaGrant = {
  user_id: string;
  active: boolean;
  starts_at: string;
  expires_at: string;
};

function member(user: User, grant?: BetaGrant | null) {
  const accessActive =
    Boolean(grant?.active) &&
    Boolean(grant?.starts_at && new Date(grant.starts_at).getTime() <= Date.now()) &&
    Boolean(grant?.expires_at && new Date(grant.expires_at).getTime() > Date.now());

  return {
    id: user.id,
    email: user.email || "",
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at || null,
    invitedAt:
      typeof user.app_metadata?.beta_invited_at === "string"
        ? user.app_metadata.beta_invited_at
        : null,
    accessActive,
    accessStartsAt: grant?.starts_at || null,
    accessExpiresAt: grant?.expires_at || null,
    locale: user.user_metadata?.ajg_builder_locale === "en" ? "en" : "fr"
  };
}

type AdminContext =
  | { ok: false; response: NextResponse }
  | { ok: true; service: SupabaseClient; adminUserId: string };

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

  return { ok: true, service, adminUserId: user.id };
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
    const userIds = users.map((user) => user.id);
    const { data: grants, error: grantsError } = userIds.length
      ? await auth.service
          .from("beta_access_grants")
          .select("user_id,active,starts_at,expires_at")
          .in("user_id", userIds)
      : { data: [], error: null };
    if (grantsError) throw grantsError;
    const grantsByUser = new Map(
      (grants || []).map((grant) => [grant.user_id, grant as BetaGrant])
    );

    return NextResponse.json(
      {
        limit: 25,
        defaultAccessDays: 30,
        members: users
          .map((user) => member(user, grantsByUser.get(user.id)))
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

  const gate = await evaluatePrivateBetaGate();
  if (!gate.ready) {
    return NextResponse.json(
      {
        error: "La bêta privée est temporairement verrouillée par les contrôles techniques.",
        issues: gate.issues
      },
      { status: 409 }
    );
  }

  const body = await request.json().catch(() => null);
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const locale: "fr" | "en" = body?.locale === "en" ? "en" : "fr";
  const durationDaysRaw = Number(body?.durationDays ?? 30);
  const durationDays =
    Number.isInteger(durationDaysRaw) && durationDaysRaw >= 1 && durationDaysRaw <= 90
      ? durationDaysRaw
      : 0;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Adresse e-mail invalide" }, { status: 400 });
  }
  if (!durationDays) {
    return NextResponse.json(
      { error: "La durée Beta Tester doit être comprise entre 1 et 90 jours." },
      { status: 400 }
    );
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
    const startsAt = new Date();
    const expiresAt = new Date(
      startsAt.getTime() + durationDays * 24 * 60 * 60 * 1000
    ).toISOString();

    if (existing) {
      const { error: grantError } = await auth.service
        .from("beta_access_grants")
        .upsert(
          {
            user_id: existing.id,
            active: true,
            starts_at: startsAt.toISOString(),
            expires_at: expiresAt,
            granted_by: auth.adminUserId,
            granted_at: startsAt.toISOString(),
            updated_at: startsAt.toISOString()
          },
          { onConflict: "user_id" }
        );
      if (grantError) throw grantError;
      const { data, error } = await auth.service.auth.admin.updateUserById(existing.id, {
        app_metadata: {
          ...existing.app_metadata,
          ajg_beta: true,
          beta_invited_at: invitedAt,
          beta_source: "admin",
          beta_access_expires_at: expiresAt
        },
        user_metadata: {
          ...existing.user_metadata,
          ajg_builder_locale: locale
        }
      });
      if (error || !data.user) throw error || new Error("user_update_failed");

      return NextResponse.json({
        invited: false,
        existing: true,
        member: member(data.user, {
          user_id: data.user.id,
          active: true,
          starts_at: startsAt.toISOString(),
          expires_at: expiresAt
        })
      });
    }

    const { data: invite, error: inviteError } =
      await auth.service.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${appBaseUrl()}/builder?lang=${locale}`,
        data: { beta_invitation: true, ajg_builder_locale: locale }
      });

    if (inviteError || !invite.user) {
      throw inviteError || new Error("invite_failed");
    }

    const { error: grantError } = await auth.service
      .from("beta_access_grants")
      .upsert(
        {
          user_id: invite.user.id,
          active: true,
          starts_at: startsAt.toISOString(),
          expires_at: expiresAt,
          granted_by: auth.adminUserId,
          granted_at: startsAt.toISOString(),
          updated_at: startsAt.toISOString()
        },
        { onConflict: "user_id" }
      );
    if (grantError) throw grantError;

    const { data: updated, error: updateError } =
      await auth.service.auth.admin.updateUserById(invite.user.id, {
        app_metadata: {
          ...invite.user.app_metadata,
          ajg_beta: true,
          beta_invited_at: invitedAt,
          beta_source: "admin",
          beta_access_expires_at: expiresAt
        }
      });

    if (updateError || !updated.user) {
      throw updateError || new Error("invite_metadata_failed");
    }

    return NextResponse.json(
      {
        invited: true,
        existing: false,
        member: member(updated.user, {
          user_id: updated.user.id,
          active: true,
          starts_at: startsAt.toISOString(),
          expires_at: expiresAt
        })
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

    const now = new Date().toISOString();
    const { error: grantError } = await auth.service
      .from("beta_access_grants")
      .update({ active: false, updated_at: now })
      .eq("user_id", userId);
    if (grantError) throw grantError;

    const { error } = await auth.service.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...current.user.app_metadata,
        ajg_beta: false,
        beta_removed_at: now,
        beta_access_expires_at: null
      }
    });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Retrait de la cohorte impossible" }, { status: 502 });
  }
}
