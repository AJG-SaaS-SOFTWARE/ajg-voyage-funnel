import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  syncVercelDomain,
  VercelDomainSyncError,
  type VercelDomainKind
} from "../../../../lib/vercel-domain-sync";

export const runtime = "nodejs";

type Body = { siteId?: string; domainId?: string };

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serverKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !publicKey || !serverKey) {
    return NextResponse.json(
      { error: "Domain automation not configured" },
      { status: 503 }
    );
  }

  const bearer = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!bearer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    return NextResponse.json({ error: "Invalid domain request" }, { status: 400 });
  }

  const { data: site } = await userClient
    .from("sites")
    .select("id")
    .eq("id", body.siteId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!site) {
    return NextResponse.json({ error: "Site unavailable" }, { status: 404 });
  }

  const { data: domain } = await userClient
    .from("domains")
    .select("id,hostname,kind,verification_status")
    .eq("id", body.domainId)
    .eq("site_id", body.siteId)
    .maybeSingle();
  if (!domain) {
    return NextResponse.json({ error: "Domain unavailable" }, { status: 404 });
  }

  if (domain.kind === "custom_domain") {
    const { data: ent } = await userClient.rpc("get_my_site_entitlements", {
      p_site_id: body.siteId
    });
    const row = Array.isArray(ent) ? ent[0] : ent;
    if (!row?.custom_domain) {
      return NextResponse.json(
        { error: "Custom domain unavailable" },
        { status: 403 }
      );
    }
  }

  if (domain.kind !== "custom_domain" && domain.kind !== "managed_subdomain") {
    return NextResponse.json({ error: "Unsupported domain kind" }, { status: 400 });
  }

  let syncResult;
  try {
    syncResult = await syncVercelDomain(
      domain.hostname,
      domain.kind as VercelDomainKind
    );
  } catch (error) {
    if (error instanceof VercelDomainSyncError) {
      return NextResponse.json(
        {
          error: "Unable to attach domain",
          vercel: {
            status: error.status,
            code: error.code,
            message: error.message
          }
        },
        { status: error.status === 503 ? 503 : 502 }
      );
    }
    return NextResponse.json({ error: "Domain synchronization failed" }, { status: 502 });
  }

  const service = createClient(url, serverKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  if (syncResult.verified) {
    if (domain.kind === "custom_domain") {
      await service
        .from("domains")
        .update({ is_primary: false })
        .eq("site_id", body.siteId);
      await service
        .from("domains")
        .update({ verification_status: "verified", is_primary: true })
        .eq("id", domain.id);
    } else {
      const { data: verifiedCustom } = await service
        .from("domains")
        .select("id")
        .eq("site_id", body.siteId)
        .eq("kind", "custom_domain")
        .eq("verification_status", "verified")
        .limit(1)
        .maybeSingle();

      if (!verifiedCustom) {
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
          .update({ verification_status: "verified", is_primary: false })
          .eq("id", domain.id);
      }
    }
  } else {
    await service
      .from("domains")
      .update({ verification_status: "pending", is_primary: false })
      .eq("id", domain.id);
  }

  return NextResponse.json({ ok: true, ...syncResult });
}
