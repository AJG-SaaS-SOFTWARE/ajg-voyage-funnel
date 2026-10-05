import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type StepStatus = "pass" | "skipped";
type Step = { key: string; label: string; status: StepStatus; detail: string };

function bearer(request: Request) {
  const value = request.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

function shortError(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 300) : "Unknown error";
}

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !publishable || !serviceKey) {
    return NextResponse.json({ error: "E2E validation unavailable" }, { status: 503 });
  }

  const token = bearer(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userClient = createClient(url, publishable, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const {
    data: { user },
    error: userError
  } = await userClient.auth.getUser(token);
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: role, error: roleError } = await userClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleError || role?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const includeAi = body?.includeAi === true;
  const steps: Step[] = [
    {
      key: "auth",
      label: "Session authentifiée",
      status: "pass",
      detail: "Session Supabase et rôle administrateur validés."
    }
  ];

  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  const slug = `ajg-e2e-${suffix}`;
  const marker = `AJG E2E ${suffix}`;
  const assetId = `e2e-${suffix}`;
  let siteId = "";
  let feedbackId = "";
  let privatePath = "";
  let publicPath = "";
  let currentStage = "site-create";
  let cleanupOk = true;

  try {
    const { data: site, error: createError } = await userClient
      .from("sites")
      .insert({
        owner_id: user.id,
        slug,
        status: "draft",
        primary_language: "fr",
        enabled_languages: ["fr"],
        brand_name: marker,
        first_name: "Test",
        last_name: "E2E",
        hero_title: marker,
        hero_subtitle: "Site temporaire de validation technique ELTARA.",
        hero_tagline: "Validation interne",
        about_heading: "À propos du test",
        about_text: "Ce site temporaire vérifie le parcours réel d’ELTARA. Il est supprimé automatiquement à la fin du contrôle.",
        booking_label: "Continuer",
        booking_url: "",
        instagram_url: "",
        facebook_url: "",
        profile_image_url: "",
        show_travel_journals: false,
        compliance_profile: "independent-v1",
        design_assets: {},
        legal_config: {},
        public_access_state: "live"
      })
      .select("id,slug")
      .single();

    if (createError || !site) throw createError || new Error("Temporary site creation failed.");
    siteId = site.id;

    const { error: entitlementError } = await service
      .from("site_subscriptions")
      .upsert(
        {
          site_id: siteId,
          owner_id: user.id,
          plan_key: "growth",
          status: "active",
          provider: "internal-e2e",
          provider_customer_id: null,
          provider_subscription_id: null,
          current_period_end: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString()
        },
        { onConflict: "site_id" }
      );
    if (entitlementError) throw entitlementError;

    if (includeAi) {
      const { error: launchGrantError } = await service
        .from("site_ai_launch_entitlements")
        .insert({
          site_id: siteId,
          owner_id: user.id,
          source: "admin",
          status: "active",
          operations_total: 1,
          operations_used: 0,
          external_reference: `e2e:${siteId}`,
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        });
      if (launchGrantError) throw launchGrantError;
    }

    const { data: e2eEntitlements, error: e2eEntitlementError } = await userClient.rpc(
      "get_my_site_entitlements",
      { p_site_id: siteId }
    );
    const e2eEntitlement = Array.isArray(e2eEntitlements)
      ? e2eEntitlements[0]
      : e2eEntitlements;
    if (
      e2eEntitlementError ||
      e2eEntitlement?.plan_key !== "growth" ||
      e2eEntitlement?.premium_architect !== true
    ) {
      throw e2eEntitlementError || new Error("Temporary Growth entitlement verification failed.");
    }

    steps.push({
      key: "create",
      label: "Création",
      status: "pass",
      detail: "Site temporaire créé via la session authentifiée et les RLS."
    });
    steps.push({
      key: "entitlement",
      label: "Droits Growth / BUILD temporaires",
      status: "pass",
      detail: includeAi ? "Le site E2E reçoit un droit Growth interne et un crédit BUILD unique, tous deux supprimés avec le site." : "Le site E2E reçoit uniquement pendant la recette un droit Growth interne, supprimé avec le site."
    });

    let proposal: any = null;
    currentStage = "ai";

    if (includeAi) {
      const aiResponse = await fetch(new URL("/api/ai/write", request.url), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          field: "siteArchitect",
          siteId,
          instruction:
            "Crée une proposition simple de site vitrine pour valider le fonctionnement technique. N'invente aucune donnée commerciale, chiffre, témoignage ou certification.",
          currentText: "",
          context: {
            language: "fr",
            affiliation: "independent",
            firstName: "Test",
            brandName: marker,
            architectBrief:
              "Site interne de validation ELTARA pour une activité indépendante fictive. Objectif : vérifier la génération structurée, la publication et le rendu, sans donnée commerciale réelle.",
            contentLibrary: []
          }
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(110000)
      });

      const aiBody = await aiResponse.json().catch(() => null);
      if (!aiResponse.ok || !aiBody?.proposal) {
        throw new Error(aiBody?.error || `AI Site Architect returned HTTP ${aiResponse.status}.`);
      }
      if (
        !aiBody.proposal?.intelligence?.understoodNeed ||
        aiBody.proposal?.premiumAudit?.reviewed !== true ||
        aiBody.proposal?.premiumAudit?.finalVerified !== true ||
        aiBody.proposal?.premiumAudit?.deterministicChecksPerformed !== true ||
        aiBody.proposal?.premiumAudit?.deterministicBlockingIssuesDetected !== 0 ||
        (aiBody.proposal?.premiumAudit?.refinementApplied === true &&
          aiBody.proposal?.premiumAudit?.finalReviewPerformed !== true)
      ) {
        throw new Error(
          "Premium Architect strategy, deterministic checks, audit or final quality gate metadata is missing."
        );
      }
      proposal = aiBody.proposal;
      steps.push({
        key: "ai",
        label: "AI Site Architect Premium",
        status: "pass",
        detail:
          aiBody.proposal.premiumAudit.refinementApplied
            ? "Stratégie, contrôles déterministes, audit critique, raffinement automatique et contrôle final indépendant validés."
            : "Stratégie, génération structurée, contrôles déterministes et audit critique validés sans raffinement nécessaire ; quality gate final validé."
      });
    } else {
      steps.push({
        key: "ai",
        label: "AI Site Architect",
        status: "skipped",
        detail: "Non exécuté : relancer avec l’option IA pour consommer une génération réelle."
      });
    }

    currentStage = "media-private";
    privatePath = `${user.id}/${siteId}/library/${assetId}.png`;
    const onePixelPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZB7sAAAAASUVORK5CYII=",
      "base64"
    );
    const { error: uploadError } = await service.storage
      .from("site-private-media")
      .upload(privatePath, onePixelPng, {
        contentType: "image/png",
        cacheControl: "60",
        upsert: false
      });
    if (uploadError) throw uploadError;

    currentStage = "media-promote";
    const promoteResponse = await fetch(new URL("/api/media/promote", request.url), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        siteId,
        privateRef: `private://${privatePath}`,
        assetId,
        rights: "owned"
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000)
    });
    const promoted = await promoteResponse.json().catch(() => null);
    if (!promoteResponse.ok || typeof promoted?.url !== "string" || typeof promoted?.path !== "string") {
      throw new Error(promoted?.error || `Media promotion returned HTTP ${promoteResponse.status}.`);
    }
    publicPath = promoted.path;
    steps.push({
      key: "media",
      label: "Média privé → public",
      status: "pass",
      detail: "Import privé et promotion via la vraie route de publication validés."
    });

    currentStage = "publish";
    const heroTitle =
      typeof proposal?.heroTitle === "string" && proposal.heroTitle.trim()
        ? proposal.heroTitle.trim().slice(0, 90)
        : marker;
    const heroSubtitle =
      typeof proposal?.heroSubtitle === "string" && proposal.heroSubtitle.trim()
        ? proposal.heroSubtitle.trim().slice(0, 420)
        : "Site temporaire de validation technique ELTARA.";
    const aboutText =
      typeof proposal?.aboutText === "string" && proposal.aboutText.trim()
        ? proposal.aboutText.trim().slice(0, 1800)
        : "Ce site temporaire vérifie le parcours réel d’ELTARA et sera supprimé automatiquement.";
    const architecture = {
      mode: "single",
      pages: [
        {
          id: "home",
          slug: "",
          title: "Accueil",
          kind: "home",
          purpose: "Validation E2E",
          enabled: true,
          assetIds: [assetId]
        }
      ]
    };
    const contentLibrary = {
      assets: [
        {
          id: assetId,
          kind: "image",
          name: "Image E2E",
          url: promoted.url,
          text: "",
          rights: "owned",
          sourceUrl: "",
          notes: "Temporary E2E asset",
          publishable: true
        }
      ]
    };

    const { error: publishError } = await userClient
      .from("sites")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        hero_title: heroTitle,
        hero_subtitle: heroSubtitle,
        about_text: aboutText,
        design_assets: {
          ...(proposal?.design || {}),
          architecture,
          contentLibrary
        }
      })
      .eq("id", siteId)
      .eq("owner_id", user.id);
    if (publishError) throw publishError;

    const root =
      process.env.NEXT_PUBLIC_PUBLISHED_ROOT_DOMAIN ||
      "voyage.ajgsolutionsgroup.com";
    const { error: domainError } = await userClient.from("domains").insert({
      site_id: siteId,
      hostname: `${slug}.${root}`,
      kind: "managed_subdomain",
      verification_status: "verified",
      is_primary: true
    });
    if (domainError) throw domainError;

    steps.push({
      key: "publish",
      label: "Publication",
      status: "pass",
      detail: "Site publié et sous-domaine managé créé dans le modèle de données."
    });

    currentStage = "public-render";
    const publicResponse = await fetch(new URL(`/site/${slug}`, request.url), {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(15000)
    });
    const publicHtml = await publicResponse.text();
    if (!publicResponse.ok || (!publicHtml.includes(marker) && !publicHtml.includes(heroTitle))) {
      throw new Error(`Public site validation returned HTTP ${publicResponse.status} without the expected content.`);
    }
    steps.push({
      key: "public",
      label: "Rendu public",
      status: "pass",
      detail: "La route publique dynamique retourne le site publié et son contenu attendu."
    });

    currentStage = "feedback";
    const { data: feedback, error: feedbackError } = await userClient
      .from("user_feedback")
      .insert({
        user_id: user.id,
        site_id: siteId,
        category: "quality",
        rating: 5,
        message: `E2E temporaire ${suffix} — à supprimer automatiquement.`,
        status: "new"
      })
      .select("id")
      .single();
    if (feedbackError || !feedback) {
      throw feedbackError || new Error("Feedback insert failed.");
    }
    feedbackId = feedback.id;
    steps.push({
      key: "feedback",
      label: "Feedback",
      status: "pass",
      detail: "Insertion d’un feedback via la session utilisateur et les RLS validée."
    });

    currentStage = "export";
    const exportResponse = await fetch(
      new URL(`/api/export/site?siteId=${encodeURIComponent(siteId)}&format=archive`, request.url),
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(20000)
      }
    );
    const archive = await exportResponse.arrayBuffer();
    if (
      !exportResponse.ok ||
      !/application\/gzip/i.test(exportResponse.headers.get("content-type") || "") ||
      archive.byteLength < 512
    ) {
      throw new Error(`Recovery archive validation failed with HTTP ${exportResponse.status}.`);
    }
    steps.push({
      key: "export",
      label: "Export de récupération",
      status: "pass",
      detail: `Archive TAR.GZ générée avec succès (${archive.byteLength} octets).`
    });

    currentStage = "complete";
  } catch (error) {
    const failure = {
      error: "ELTARA E2E validation failed",
      stage: currentStage,
      detail: shortError(error),
      steps
    };

    if (feedbackId) {
      const { error } = await service.from("user_feedback").delete().eq("id", feedbackId);
      if (error) cleanupOk = false;
    }
    if (privatePath) {
      const { error } = await service.storage.from("site-private-media").remove([privatePath]);
      if (error) cleanupOk = false;
    }
    if (publicPath) {
      const { error } = await service.storage.from("site-media").remove([publicPath]);
      if (error) cleanupOk = false;
    }
    if (siteId) {
      const { error } = await service.from("sites").delete().eq("id", siteId);
      if (error) cleanupOk = false;
    }

    return NextResponse.json(
      { ...failure, cleanupOk },
      {
        status: 500,
        headers: {
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff"
        }
      }
    );
  }

  if (feedbackId) {
    const { error } = await service.from("user_feedback").delete().eq("id", feedbackId);
    if (error) cleanupOk = false;
  }
  if (privatePath) {
    const { error } = await service.storage.from("site-private-media").remove([privatePath]);
    if (error) cleanupOk = false;
  }
  if (publicPath) {
    const { error } = await service.storage.from("site-media").remove([publicPath]);
    if (error) cleanupOk = false;
  }
  if (siteId) {
    const { error } = await service.from("sites").delete().eq("id", siteId);
    if (error) cleanupOk = false;
  }

  if (!cleanupOk) {
    return NextResponse.json(
      {
        error: "ELTARA E2E validation passed but cleanup failed",
        stage: "cleanup",
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

  steps.push({
    key: "cleanup",
    label: "Nettoyage",
    status: "pass",
    detail: "Site, domaine, feedback et médias temporaires supprimés."
  });

  return NextResponse.json(
    {
      ok: true,
      includeAi,
      steps
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    }
  );
}
