import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { purgeBuilderAccount } from "../../../../lib/privacy-purge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Step = {
  key: string;
  status: "pass";
  detail: string;
};

function bearer(request: Request) {
  const value = request.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

async function requireAdmin(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";

  if (!url || !publishable || !serviceKey) return null;

  const token = bearer(request);
  if (!token) return null;

  const userClient = createClient(url, publishable, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const {
    data: { user },
    error: userError
  } = await userClient.auth.getUser(token);
  if (userError || !user) return null;

  const { data: role, error: roleError } = await userClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (roleError || role?.role !== "admin") return null;

  return {
    service: createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  };
}

async function removeIfPresent(
  service: SupabaseClient,
  bucket: string,
  path: string
) {
  if (!path) return;
  await service.storage.from(bucket).remove([path]).catch(() => undefined);
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  if (body?.confirmation !== "TESTER") {
    return NextResponse.json(
      { error: "Recopiez exactement TESTER pour lancer la recette." },
      { status: 400 }
    );
  }

  const service = auth.service;
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const slug = `privacy-e2e-${suffix}`;
  const email = `privacy-e2e-${suffix}@ajgsolutionsgroup.com`;
  const password = `E2e!${crypto.randomUUID()}Aa1`;
  const hostname = `${slug}.voyage.ajgsolutionsgroup.com`;
  const steps: Step[] = [];

  let userId = "";
  let siteId = "";
  let requestId = "";
  let publicPath = "";
  let privatePath = "";

  try {
    const { data: createdUser, error: createUserError } =
      await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: {
          ajg_internal_e2e: true,
          purpose: "privacy_erasure"
        }
      });
    if (createUserError || !createdUser.user) {
      throw createUserError || new Error("temporary_user_create_failed");
    }
    userId = createdUser.user.id;
    steps.push({
      key: "user",
      status: "pass",
      detail: "Compte Auth temporaire créé sans invitation utilisateur."
    });

    const { data: site, error: siteError } = await service
      .from("sites")
      .insert({
        owner_id: userId,
        slug,
        status: "published",
        primary_language: "fr",
        enabled_languages: ["fr"],
        brand_name: "Privacy E2E",
        first_name: "Privacy",
        last_name: "E2E",
        hero_title: "Recette d’effacement",
        hero_subtitle: "Site temporaire interne.",
        hero_tagline: "Validation RGPD",
        about_heading: "Test",
        about_text: "Donnée temporaire à supprimer.",
        booking_label: "Aucun",
        booking_url: "",
        instagram_url: "",
        facebook_url: "",
        profile_image_url: "",
        show_travel_journals: false,
        compliance_profile: "independent-v1",
        design_assets: {},
        legal_config: {},
        public_access_state: "live",
        privacy_state: "active"
      })
      .select("id")
      .single();
    if (siteError || !site) throw siteError || new Error("temporary_site_create_failed");
    siteId = site.id;

    const { error: domainError } = await service.from("domains").insert({
      site_id: siteId,
      hostname,
      kind: "managed_subdomain",
      verification_status: "pending",
      is_primary: false
    });
    if (domainError) throw domainError;

    steps.push({
      key: "site",
      status: "pass",
      detail: "Site et domaine temporaires créés."
    });

    const bytes = Buffer.from("AJG privacy purge E2E", "utf8");
    publicPath = `${userId}/${siteId}/privacy-e2e-public.txt`;
    privatePath = `${userId}/${siteId}/privacy-e2e-private.txt`;

    const [{ error: publicUploadError }, { error: privateUploadError }] =
      await Promise.all([
        service.storage.from("site-media").upload(publicPath, bytes, {
          contentType: "text/plain",
          upsert: false
        }),
        service.storage.from("site-private-media").upload(privatePath, bytes, {
          contentType: "text/plain",
          upsert: false
        })
      ]);
    if (publicUploadError) throw publicUploadError;
    if (privateUploadError) throw privateUploadError;

    steps.push({
      key: "storage",
      status: "pass",
      detail: "Médias de test présents dans les buckets public et privé."
    });

    const { data: createdRequest, error: requestError } = await service.rpc(
      "request_builder_account_erasure",
      { p_owner_id: userId }
    );
    if (requestError || !createdRequest) {
      throw requestError || new Error("erasure_request_failed");
    }
    requestId = createdRequest;

    const { data: frozenSite, error: frozenError } = await service
      .from("sites")
      .select("privacy_state,public_access_state")
      .eq("id", siteId)
      .single();
    if (
      frozenError ||
      frozenSite?.privacy_state !== "erasure_requested" ||
      frozenSite?.public_access_state !== "suspended"
    ) {
      throw frozenError || new Error("erasure_lock_not_applied");
    }

    steps.push({
      key: "request",
      status: "pass",
      detail: "Demande compte enregistrée ; site immédiatement suspendu et verrouillé."
    });

    const { error: processingError } = await service
      .from("data_erasure_requests")
      .update({
        status: "processing",
        processing_started_at: new Date().toISOString(),
        last_error: null
      })
      .eq("id", requestId);
    if (processingError) throw processingError;

    const purge = await purgeBuilderAccount(service, userId);

    const { error: finishError } = await service
      .from("data_erasure_requests")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        systems_processed: purge.systems,
        last_error: null
      })
      .eq("id", requestId);
    if (finishError) throw finishError;

    steps.push({
      key: "purge",
      status: "pass",
      detail: "Purge compte exécutée jusqu’à la suppression Auth."
    });

    const [{ data: remainingSite }, { data: remainingDomain }, authLookup, requestCheck] =
      await Promise.all([
        service.from("sites").select("id").eq("id", siteId).maybeSingle(),
        service.from("domains").select("id").eq("hostname", hostname).maybeSingle(),
        service.auth.admin.getUserById(userId),
        service
          .from("data_erasure_requests")
          .select("status,user_id,site_id,systems_processed")
          .eq("id", requestId)
          .single()
      ]);

    if (remainingSite) throw new Error("site_residue");
    if (remainingDomain) throw new Error("domain_residue");
    if (authLookup.data.user) throw new Error("auth_user_residue");
    if (
      requestCheck.error ||
      requestCheck.data?.status !== "completed" ||
      requestCheck.data?.user_id !== null ||
      requestCheck.data?.site_id !== null
    ) {
      throw requestCheck.error || new Error("pseudonymized_audit_missing");
    }

    const [publicFiles, privateFiles] = await Promise.all([
      service.storage.from("site-media").list(`${userId}/${siteId}`, { limit: 10 }),
      service.storage.from("site-private-media").list(`${userId}/${siteId}`, { limit: 10 })
    ]);
    if ((publicFiles.data || []).length || (privateFiles.data || []).length) {
      throw new Error("storage_residue");
    }

    steps.push({
      key: "verify",
      status: "pass",
      detail: "Auth, site, domaine et médias absents ; journal RGPD conservé sans identifiant utilisateur/site."
    });

    // The E2E journal is itself test data. Remove it only after its pseudonymized
    // persistence has been verified.
    const { error: auditCleanupError } = await service
      .from("data_erasure_requests")
      .delete()
      .eq("id", requestId);
    if (auditCleanupError) throw auditCleanupError;
    requestId = "";

    steps.push({
      key: "cleanup",
      status: "pass",
      detail: "Journal E2E temporaire supprimé ; aucun résidu de recette conservé."
    });

    return NextResponse.json({
      ok: true,
      marker: slug,
      steps
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "unknown";
    console.error("Privacy purge E2E failed", { stage: steps.at(-1)?.key || "start", code });

    await removeIfPresent(service, "site-media", publicPath);
    await removeIfPresent(service, "site-private-media", privatePath);

    if (siteId) {
      await service.from("domains").delete().eq("site_id", siteId).catch(() => undefined);
      await service.from("sites").delete().eq("id", siteId).catch(() => undefined);
    }
    if (requestId) {
      await service
        .from("data_erasure_requests")
        .delete()
        .eq("id", requestId)
        .catch(() => undefined);
    }
    if (userId) {
      await service.auth.admin.deleteUser(userId).catch(() => undefined);
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Recette RGPD non finalisée.",
        stage: steps.at(-1)?.key || "start",
        detail: code.slice(0, 300),
        steps
      },
      { status: 500 }
    );
  }
}
