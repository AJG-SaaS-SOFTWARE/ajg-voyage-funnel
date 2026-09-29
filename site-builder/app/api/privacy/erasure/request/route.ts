import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { localize, requestProductLocale } from "../../../../../lib/server-locale";

export const runtime = "nodejs";

function configured() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    publicKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "",
    serviceKey:
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      ""
  };
}

export async function POST(request: Request) {
  const locale = requestProductLocale(request);
  const tr = (fr: string, en: string) => localize(locale, fr, en);
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 4096) {
    return NextResponse.json({ error: tr("Requête trop volumineuse.", "Request too large.") }, { status: 413 });
  }

  const { url, publicKey, serviceKey } = configured();
  if (!url || !publicKey || !serviceKey) {
    return NextResponse.json({ error: tr("Service de confidentialité indisponible.", "Privacy service unavailable.") }, { status: 503 });
  }

  const token =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!token) {
    return NextResponse.json({ error: tr("Reconnectez-vous pour continuer.", "Sign in again to continue.") }, { status: 401 });
  }

  const userClient = createClient(url, publicKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser(token);
  if (userError || !user) {
    return NextResponse.json({ error: "Reconnectez-vous pour continuer." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const scope = body?.scope === "account" ? "account" : body?.scope === "site" ? "site" : "";
  const confirmation =
    typeof body?.confirmation === "string" ? body.confirmation.trim() : "";
  if (!scope || !confirmation) {
    return NextResponse.json({ error: tr("Confirmation requise.", "Confirmation required.") }, { status: 400 });
  }

  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  if (scope === "site") {
    const siteId = typeof body?.siteId === "string" ? body.siteId : "";
    if (!siteId) {
      return NextResponse.json({ error: tr("Site à effacer non identifié.", "Website to erase is not identified.") }, { status: 400 });
    }

    const { data: site, error: siteError } = await userClient
      .from("sites")
      .select("id,slug")
      .eq("id", siteId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (siteError || !site) {
      return NextResponse.json({ error: tr("Site introuvable.", "Website not found.") }, { status: 404 });
    }
    if (confirmation !== site.slug) {
      return NextResponse.json(
        { error: `${tr("Recopiez exactement", "Type exactly")} « ${site.slug} » ${tr("pour confirmer.", "to confirm.")}` },
        { status: 400 }
      );
    }

    const { data: requestId, error } = await service.rpc(
      "request_builder_site_erasure",
      { p_site_id: site.id, p_owner_id: user.id }
    );
    if (error || !requestId) {
      console.error("Site erasure request failed", { code: error?.code || "unknown" });
      return NextResponse.json({ error: tr("Impossible d’enregistrer la demande.", "Unable to record the request.") }, { status: 503 });
    }

    return NextResponse.json({ requestId, scope: "site" });
  }

  const email = (user.email || "").trim().toLowerCase();
  if (!email || confirmation.toLowerCase() !== email) {
    return NextResponse.json(
      { error: tr("Recopiez exactement l’adresse e-mail de votre compte pour confirmer.", "Type your account email address exactly to confirm.") },
      { status: 400 }
    );
  }

  const { data: requestId, error } = await service.rpc(
    "request_builder_account_erasure",
    { p_owner_id: user.id }
  );
  if (error || !requestId) {
    console.error("Account erasure request failed", { code: error?.code || "unknown" });
    return NextResponse.json({ error: "Impossible d'enregistrer la demande." }, { status: 503 });
  }

  return NextResponse.json({ requestId, scope: "account" });
}
