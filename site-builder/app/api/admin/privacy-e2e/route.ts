import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Step = {
  key: string;
  label: string;
  status: "pass";
  detail: string;
};

function bearer(request: Request) {
  const value = request.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

function shortError(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 300) : "Unknown error";
}

async function listPrefix(service: any, bucket: string, prefix: string) {
  const { data, error } = await service.storage
    .from(bucket)
    .list(prefix, { limit: 100, offset: 0 });
  if (error) {
    if (/not found|bucket/i.test(error.message || "")) return [];
    throw error;
  }
  return data || [];
}

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";

  if (!url || !publishable || !serviceKey) {
    return NextResponse.json(
      { error: "Recette RGPD indisponible." },
      { status: 503 }
    );
  }

  const token = bearer(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userClient = createClient(url, publishable, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const {
    data: { user: adminUser },
    error: adminUserError
  } = await userClient.auth.getUser(token);
  if (adminUserError || !adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: role, error: roleError } = await userClient
    .from("user_roles")
    .select("role")
    .eq("user_id", adminUser.id)
    .maybeSingle();
  if (roleError || role?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const testEmail = `privacy-e2e-${suffix}@example.invalid`;
  const slug = `privacy-e2e-${suffix}`;
  const marker = `AJG Privacy E2E ${suffix}`;
  const steps: Step[] = [];
  let testUserId = "";
  let siteId = "";
  let requestId = "";
  let publicPath = "";
  let privatePath = "";
  let stage = "create-user";

  try {
    const { data: createdUser, error: createUserError } =
      await service.auth.admin.createUser({
        email: testEmail,
        email_confirm: true,
        user_metadata: { purpose: "ajg_privacy_e2e" }
      });
    if (createUserError || !createdUser.user) {
      throw createUserError || new Error("temporary_user_creation_failed");
    }
    testUserId = createdUser.user.id;
    steps.push({
      key: "auth-create",
      label: "Compte jetable",
      status: "pass",
      detail: "Utilisateur Supabase Auth temporaire créé sans envoi d’e-mail."
    });

    stage = "create-site";
    const { data: site, error: siteError } = await service
      .from("sites")
      .insert({
        owner_id: testUserId,
        slug,
        status: "published",
        primary_language: "fr",
        enabled_languages: ["fr"],
        brand_name: marker,
        first_name: "Privacy",
        last_name: "E2E",
        hero_title: marker,
        hero_subtitle: "Site temporaire destiné à la recette d’effacement.",
        hero_tagline: "Test RGPD",
        about_heading: "Test",
        about_text:
          "Ce contenu est créé uniquement pour vérifier la purge RGPD et doit disparaître.",
        booking_label: "Continuer",
        booking_url: "",
        instagram_url: "",
        facebook_url: "",
        profile_image_url: "",
        show_travel_journals: false,
        compliance_profile: "independent-v1",
        design_assets: {},
        legal_config: {},
        public_access_state: "live",
        privacy_state: "active",
        published_at: new Date().toISOString()
      })
      .select("id")
      .single();
    if (siteError || !site) {
      throw siteError || new Error("temporary_site_creation_failed");
    }
    siteId = site.id;

    const { error: draftError } = await service.from("site_drafts").insert({
      site_id: siteId,
      owner_id: testUserId,
      config: { marker }
    });
    if (draftError) throw draftError;

    steps.push({
      key: "site-create",
      label: "Données de test",
      status: "pass",
      detail: "Site publié et brouillon dépendant créés pour vérifier la cascade."
    });

    stage = "storage-create";
    const payload = Buffer.from("AJG privacy E2E");
    publicPath = `${testUserId}/${siteId}/privacy-e2e/public.txt`;
    privatePath = `${testUserId}/${siteId}/privacy-e2e/private.txt`;

    for (const [bucket, path] of [
      ["site-media", publicPath],
      ["site-private-media", privatePath]
    ] as const) {
      const { error } = await service.storage
        .from(bucket)
        .upload(path, payload, {
          contentType: "text/plain",
          cacheControl: "60",
          upsert: false
        });
      if (error) throw error;
    }

    steps.push({
      key: "storage-create",
      label: "Médias publics et privés",
      status: "pass",
      detail: "Un fichier temporaire a été créé dans chacun des deux buckets."
    });

    stage = "request-erasure";
    const { data: erasureId, error: erasureError } = await service.rpc(
      "request_builder_account_erasure",
      { p_owner_id: testUserId }
    );
    if (erasureError || typeof erasureId !== "string") {
      throw erasureError || new Error("erasure_request_failed");
    }
    requestId = erasureId;

    const { data: suspended, error: suspendedError } = await service
      .from("sites")
      .select("privacy_state,public_access_state")
      .eq("id", siteId)
      .single();
    if (
      suspendedError ||
      suspended?.privacy_state !== "erasure_requested" ||
      suspended?.public_access_state !== "suspended"
    ) {
      throw suspendedError || new Error("privacy_suspension_not_applied");
    }

    steps.push({
      key: "request",
      label: "Demande d’effacement",
      status: "pass",
      detail:
        "La vraie primitive de demande compte suspend immédiatement le site et verrouille sa confidentialité."
    });

    stage = "purge";
    const purgeResponse = await fetch(
      new URL("/api/admin/privacy-erasure", request.url),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          requestId,
          confirmation: "PURGER"
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(90000)
      }
    );
    const purge = await purgeResponse.json().catch(() => ({}));
    if (!purgeResponse.ok || purge?.ok !== true) {
      throw new Error(
        purge?.error || `privacy_purge_http_${purgeResponse.status}`
      );
    }

    steps.push({
      key: "purge",
      label: "Purge contrôlée",
      status: "pass",
      detail:
        "La vraie route admin a exécuté la purge du site puis la suppression de l’identité Auth."
    });

    stage = "verify";
    const { data: remainingSites, error: remainingSitesError } = await service
      .from("sites")
      .select("id")
      .eq("owner_id", testUserId);
    if (remainingSitesError) throw remainingSitesError;
    if ((remainingSites || []).length !== 0) {
      throw new Error("site_residue_detected");
    }

    const [publicResidue, privateResidue] = await Promise.all([
      listPrefix(service, "site-media", `${testUserId}/${siteId}`),
      listPrefix(service, "site-private-media", `${testUserId}/${siteId}`)
    ]);
    if (publicResidue.length || privateResidue.length) {
      throw new Error("storage_residue_detected");
    }

    const { data: authLookup, error: authLookupError } =
      await service.auth.admin.getUserById(testUserId);
    if (!authLookupError && authLookup?.user) {
      throw new Error("auth_user_residue_detected");
    }

    const { data: requestRow, error: requestReadError } = await service
      .from("data_erasure_requests")
      .select("status,user_id,site_id,completed_at,systems_processed")
      .eq("id", requestId)
      .single();
    if (requestReadError) throw requestReadError;
    if (
      requestRow.status !== "completed" ||
      requestRow.user_id !== null ||
      requestRow.site_id !== null ||
      !requestRow.completed_at
    ) {
      throw new Error("erasure_audit_not_pseudonymized");
    }

    steps.push({
      key: "verify",
      label: "Zéro résidu de contenu",
      status: "pass",
      detail:
        "Compte Auth, site et médias ont disparu ; le journal RGPD reste terminé et pseudonymisé."
    });

    return NextResponse.json(
      {
        ok: true,
        requestId,
        steps,
        systemsProcessed: requestRow.systems_processed || []
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff"
        }
      }
    );
  } catch (error) {
    console.error("Privacy E2E failed", {
      stage,
      code: shortError(error),
      requestId: requestId || null
    });

    // Best-effort cleanup only for a failed test. Never touches any account
    // except the generated disposable user held in testUserId.
    if (testUserId) {
      if (siteId) {
        if (publicPath) {
          await service.storage.from("site-media").remove([publicPath]).catch(() => undefined);
        }
        if (privatePath) {
          await service.storage.from("site-private-media").remove([privatePath]).catch(() => undefined);
        }
        await service.from("sites").delete().eq("id", siteId).eq("owner_id", testUserId);
      }
      await service.auth.admin.deleteUser(testUserId).catch(() => undefined);
    }

    return NextResponse.json(
      {
        error: "Recette RGPD E2E échouée.",
        stage,
        detail: shortError(error),
        steps
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff"
        }
      }
    );
  }
}
