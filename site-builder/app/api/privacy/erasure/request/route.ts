import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 4096) {
    return NextResponse.json({ error: "Requête trop volumineuse." }, { status: 413 });
  }

  const { url, publicKey, serviceKey } = configured();
  if (!url || !publicKey || !serviceKey) {
    return NextResponse.json({ error: "Service de confidentialité indisponible." }, { status: 503 });
  }

  const token =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!token) {
    return NextResponse.json({ error: "Reconnectez-vous pour continuer." }, { status: 401 });
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
    return NextResponse.json({ error: "Confirmation requise." }, { status: 400 });
  }

  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  if (scope === "site") {
    const siteId = typeof body?.siteId === "string" ? body.siteId : "";
    if (!siteId) {
      return NextResponse.json({ error: "Site à effacer non identifié." }, { status: 400 });
    }

    const { data: site, error: siteError } = await userClient
      .from("sites")
      .select("id,slug")
      .eq("id", siteId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (siteError || !site) {
      return NextResponse.json({ error: "Site introuvable." }, { status: 404 });
    }
    if (confirmation !== site.slug) {
      return NextResponse.json(
        { error: `Recopiez exactement « ${site.slug} » pour confirmer.` },
        { status: 400 }
      );
    }

    const { data: requestId, error } = await service.rpc(
      "request_builder_site_erasure",
      { p_site_id: site.id, p_owner_id: user.id }
    );
    if (error || !requestId) {
      console.error("Site erasure request failed", { code: error?.code || "unknown" });
      return NextResponse.json({ error: "Impossible d'enregistrer la demande." }, { status: 503 });
    }

    return NextResponse.json({ requestId, scope: "site" });
  }

  const email = (user.email || "").trim().toLowerCase();
  if (!email || confirmation.toLowerCase() !== email) {
    return NextResponse.json(
      { error: "Recopiez exactement l’adresse e-mail de votre compte pour confirmer." },
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
