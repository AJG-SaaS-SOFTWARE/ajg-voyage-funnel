import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  syncVercelDomain,
  VercelDomainSyncError
} from "../../../../lib/vercel-domain-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminContext =
  | { ok: false; response: NextResponse }
  | { ok: true; service: SupabaseClient };

function bearer(request: Request) {
  const value = request.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

async function requireAdmin(request: Request): Promise<AdminContext> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !publishable || !serviceKey) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Admin unavailable" }, { status: 503 })
    };
  }

  const token = bearer(request);
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    };
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
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    };
  }

  const { data: role, error: roleError } = await userClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleError || role?.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 })
    };
  }

  return {
    ok: true,
    service: createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const [{ data: domains, error: domainsError }, { data: sites, error: sitesError }] =
    await Promise.all([
      auth.service
        .from("domains")
        .select("id,site_id,hostname,verification_status,is_primary,created_at")
        .eq("kind", "managed_subdomain")
        .order("created_at", { ascending: false }),
      auth.service.from("sites").select("id,slug,status")
    ]);

  if (domainsError || sitesError) {
    return NextResponse.json(
      { error: "Sous-domaines gérés indisponibles" },
      { status: 503 }
    );
  }

  const siteById = new Map((sites || []).map((site) => [site.id, site]));
  const rows = (domains || [])
    .map((domain) => {
      const site = siteById.get(domain.site_id);
      return {
        id: domain.id,
        siteId: domain.site_id,
        slug: site?.slug || domain.hostname.split(".")[0],
        siteStatus: site?.status || "unknown",
        hostname: domain.hostname,
        verificationStatus: domain.verification_status,
        isPrimary: domain.is_primary
      };
    })
    .sort((a, b) => {
      const aReady = a.verificationStatus === "verified" ? 1 : 0;
      const bReady = b.verificationStatus === "verified" ? 1 : 0;
      return aReady - bReady || a.slug.localeCompare(b.slug);
    });

  return NextResponse.json(
    { domains: rows },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const domainId = typeof body?.domainId === "string" ? body.domainId : "";
  if (!domainId) {
    return NextResponse.json({ error: "Domaine requis" }, { status: 400 });
  }

  const { data: domain, error: domainError } = await auth.service
    .from("domains")
    .select("id,site_id,hostname,kind,verification_status")
    .eq("id", domainId)
    .eq("kind", "managed_subdomain")
    .maybeSingle();

  if (domainError || !domain) {
    return NextResponse.json({ error: "Sous-domaine introuvable" }, { status: 404 });
  }

  let syncResult;
  try {
    syncResult = await syncVercelDomain(domain.hostname, "managed_subdomain");
  } catch (error) {
    if (error instanceof VercelDomainSyncError) {
      return NextResponse.json(
        {
          error: "Préparation Vercel impossible",
          vercel: {
            status: error.status,
            code: error.code,
            message: error.message
          }
        },
        { status: error.status === 503 ? 503 : 502 }
      );
    }
    return NextResponse.json(
      { error: "Synchronisation du sous-domaine impossible" },
      { status: 502 }
    );
  }

  if (syncResult.verified) {
    const { data: verifiedCustom } = await auth.service
      .from("domains")
      .select("id")
      .eq("site_id", domain.site_id)
      .eq("kind", "custom_domain")
      .eq("verification_status", "verified")
      .limit(1)
      .maybeSingle();

    if (!verifiedCustom) {
      await auth.service
        .from("domains")
        .update({ is_primary: false })
        .eq("site_id", domain.site_id);
      await auth.service
        .from("domains")
        .update({ verification_status: "verified", is_primary: true })
        .eq("id", domain.id);
    } else {
      await auth.service
        .from("domains")
        .update({ verification_status: "verified", is_primary: false })
        .eq("id", domain.id);
    }
  } else {
    await auth.service
      .from("domains")
      .update({ verification_status: "pending", is_primary: false })
      .eq("id", domain.id);
  }

  return NextResponse.json({ ok: true, ...syncResult });
}
