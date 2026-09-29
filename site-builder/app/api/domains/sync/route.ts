import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  syncVercelDomain,
  VercelDomainSyncError
} from "../../../../lib/vercel-domain-sync";
import { localize, requestProductLocale } from "../../../../lib/server-locale";

export const runtime = "nodejs";

type Body = { siteId?: string; domainId?: string };

export async function POST(request: NextRequest) {
  const locale = requestProductLocale(request);
  const tr = (fr: string, en: string) => localize(locale, fr, en);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serverKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !publicKey || !serverKey) {
    return NextResponse.json(
      { error: tr("Automatisation des domaines non configurée.", "Domain automation is not configured.") },
      { status: 503 }
    );
  }

  const bearer = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!bearer) {
    return NextResponse.json({ error: tr("Reconnectez-vous pour continuer.", "Sign in again to continue.") }, { status: 401 });
  }

  const userClient = createClient(url, publicKey, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const {
    data: { user }
  } = await userClient.auth.getUser(bearer);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  if (!body.siteId || !body.domainId) {
    return NextResponse.json({ error: tr("Demande de domaine invalide.", "Invalid domain request.") }, { status: 400 });
  }

  const { data: site } = await userClient
    .from("sites")
    .select("id")
    .eq("id", body.siteId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!site) {
    return NextResponse.json({ error: tr("Site indisponible.", "Website unavailable.") }, { status: 404 });
  }

  const { data: domain } = await userClient
    .from("domains")
    .select("id,hostname,kind,verification_status")
    .eq("id", body.domainId)
    .eq("site_id", body.siteId)
    .maybeSingle();
  if (!domain) {
    return NextResponse.json({ error: tr("Domaine indisponible.", "Domain unavailable.") }, { status: 404 });
  }

  if (domain.kind !== "custom_domain") {
    return NextResponse.json(
      { error: tr("Les sous-domaines gérés sont administrés par AJG.", "Managed subdomains are administered by AJG.") },
      { status: 403 }
    );
  }

  const { data: ent } = await userClient.rpc("get_my_site_entitlements", {
    p_site_id: body.siteId
  });
  const row = Array.isArray(ent) ? ent[0] : ent;
  if (!row?.custom_domain) {
    return NextResponse.json(
      { error: tr("Le domaine personnalisé n’est pas disponible avec cette offre.", "Custom domain is unavailable with this plan.") },
      { status: 403 }
    );
  }

  let syncResult;
  try {
    syncResult = await syncVercelDomain(domain.hostname, "custom_domain");
  } catch (error) {
    if (error instanceof VercelDomainSyncError) {
      return NextResponse.json(
        {
          error: tr("Impossible de rattacher le domaine.", "Unable to attach domain."),
          vercel: {
            status: error.status,
            code: error.code,
            message: error.message
          }
        },
        { status: error.status === 503 ? 503 : 502 }
      );
    }
    return NextResponse.json({ error: tr("La synchronisation du domaine a échoué.", "Domain synchronization failed.") }, { status: 502 });
  }

  const service = createClient(url, serverKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  if (syncResult.verified) {
    await service
      .from("domains")
      .update({ is_primary: false })
      .eq("site_id", body.siteId);
    await service
      .from("domains")
      .update({ verification_status: "verified", is_primary: true })
      .eq("id", domain.id);
  } else {
    await service
      .from("domains")
      .update({ verification_status: "pending", is_primary: false })
      .eq("id", domain.id);
  }

  return NextResponse.json({ ok: true, ...syncResult });
}
