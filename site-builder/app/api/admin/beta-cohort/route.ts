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

type BetaActivity = {
  siteId: string | null;
  siteSlug: string | null;
  siteStatus: string | null;
  publishedAt: string | null;
  lastActivityAt: string | null;
  feedbackCount: number;
  productEventCount: number;
  aiEventCount: number;
};

function member(user: User, grant?: BetaGrant | null, activity?: BetaActivity) {
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
    locale: user.user_metadata?.ajg_builder_locale === "en" ? "en" : "fr",
    siteId: activity?.siteId || null,
    siteSlug: activity?.siteSlug || null,
    siteStatus: activity?.siteStatus || null,
    publishedAt: activity?.publishedAt || null,
    lastActivityAt: activity?.lastActivityAt || null,
    feedbackCount: activity?.feedbackCount || 0,
    productEventCount: activity?.productEventCount || 0,
    aiEventCount: activity?.aiEventCount || 0,
    ...betaOperationalStatus(user, grant, activity)
  };
}

function betaOperationalStatus(
  user: User,
  grant?: BetaGrant | null,
  activity?: BetaActivity
) {
  const now = Date.now();
  const invitedAt =
    typeof user.app_metadata?.beta_invited_at === "string"
      ? Date.parse(user.app_metadata.beta_invited_at)
      : Date.parse(user.created_at);
  const lastActivityAt = activity?.lastActivityAt
    ? Date.parse(activity.lastActivityAt)
    : user.last_sign_in_at
      ? Date.parse(user.last_sign_in_at)
      : NaN;
  const inviteAgeHours = Number.isFinite(invitedAt) ? (now - invitedAt) / 3_600_000 : 0;
  const inactivityHours = Number.isFinite(lastActivityAt) ? (now - lastActivityAt) / 3_600_000 : null;

  if (!user.last_sign_in_at) {
    return {
      betaStage: "invited" as const,
      needsFollowUp: inviteAgeHours >= 48,
      followUpReason: inviteAgeHours >= 48 ? "Invitation non activée depuis plus de 48 h." : null
    };
  }

  if (activity?.publishedAt || activity?.siteStatus === "published") {
    if ((activity.feedbackCount || 0) > 0) {
      return {
        betaStage: "complete" as const,
        needsFollowUp: false,
        followUpReason: null
      };
    }
    return {
      betaStage: "published" as const,
      needsFollowUp: inactivityHours !== null && inactivityHours >= 72,
      followUpReason:
        inactivityHours !== null && inactivityHours >= 72
          ? "Site publié mais aucun retour reçu après 72 h."
          : null
    };
  }

  if (activity?.siteId || (activity?.productEventCount || 0) > 0) {
    return {
      betaStage: "building" as const,
      needsFollowUp: inactivityHours !== null && inactivityHours >= 72,
      followUpReason:
        inactivityHours !== null && inactivityHours >= 72
          ? "Création commencée mais inactive depuis plus de 72 h."
          : null
    };
  }

  return {
    betaStage: "activated" as const,
    needsFollowUp: inactivityHours !== null && inactivityHours >= 72,
    followUpReason:
      inactivityHours !== null && inactivityHours >= 72
        ? "Compte activé mais aucune création détectée depuis plus de 72 h."
        : null
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

    const [siteResult, eventResult, feedbackResult] = userIds.length
      ? await Promise.all([
          auth.service
            .from("sites")
            .select("id,owner_id,slug,status,published_at,updated_at")
            .in("owner_id", userIds)
            .order("updated_at", { ascending: false }),
          auth.service
            .from("product_events")
            .select("user_id,site_id,event_name,created_at")
            .in("user_id", userIds)
            .gte("created_at", new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString())
            .order("created_at", { ascending: false }),
          auth.service
            .from("user_feedback")
            .select("user_id,site_id,created_at")
            .in("user_id", userIds)
            .gte("created_at", new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString())
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null }
        ];

    if (siteResult.error || eventResult.error || feedbackResult.error) {
      throw siteResult.error || eventResult.error || feedbackResult.error;
    }

    const activityByUser = new Map<string, BetaActivity>();
    for (const user of users) {
      const sites = (siteResult.data || []).filter((site) => site.owner_id === user.id);
      const primarySite = sites[0] || null;
      const events = (eventResult.data || []).filter((event) => event.user_id === user.id);
      const feedback = (feedbackResult.data || []).filter((item) => item.user_id === user.id);
      const timestamps = [
        user.last_sign_in_at || null,
        ...sites.map((site) => site.updated_at),
        ...events.map((event) => event.created_at),
        ...feedback.map((item) => item.created_at)
      ].filter((value): value is string => Boolean(value));

      activityByUser.set(user.id, {
        siteId: primarySite?.id || null,
        siteSlug: primarySite?.slug || null,
        siteStatus: primarySite?.status || null,
        publishedAt:
          sites
            .map((site) => site.published_at)
            .filter((value): value is string => Boolean(value))
            .sort()
            .at(-1) || null,
        lastActivityAt: timestamps.sort().at(-1) || null,
        feedbackCount: feedback.length,
        productEventCount: events.length,
        aiEventCount: events.filter((event) =>
          [
            "architect_generated",
            "architect_regenerated",
            "architect_refined",
            "architect_applied",
            "revision_applied"
          ].includes(event.event_name)
        ).length
      });
    }

    return NextResponse.json(
      {
        limit: 25,
        operationalTarget: 10,
        defaultAccessDays: 30,
        followUpRules: {
          invitationHours: 48,
          inactivityHours: 72
        },
        members: users
          .map((user) =>
            member(
              user,
              grantsByUser.get(user.id),
              activityByUser.get(user.id)
            )
          )
          .sort((a, b) => {
            if (a.needsFollowUp !== b.needsFollowUp) return a.needsFollowUp ? -1 : 1;
            return (b.lastActivityAt || b.invitedAt || b.createdAt).localeCompare(
              a.lastActivityAt || a.invitedAt || a.createdAt
            );
          })
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
