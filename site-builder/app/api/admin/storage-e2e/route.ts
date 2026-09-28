import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearer(request: Request) {
  const value = request.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

function encodedObjectPath(path: string) {
  return path.split("/").map((part) => encodeURIComponent(part)).join("/");
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
    return NextResponse.json(
      { error: "Storage validation unavailable" },
      { status: 503 }
    );
  }

  const token = bearer(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userClient = createClient(url, publishable, {
    global: { headers: { Authorization: `Bearer ${token}` } },
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

  const { data: site, error: siteError } = await userClient
    .from("sites")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (siteError || !site) {
    return NextResponse.json(
      { error: "Create a site before running the Storage validation." },
      { status: 409 }
    );
  }

  const { data: capabilities, error: capabilityError } = await userClient.rpc(
    "get_my_site_capabilities",
    { p_site_id: site.id }
  );
  const capability = Array.isArray(capabilities)
    ? capabilities[0]
    : capabilities;
  if (capabilityError || !capability?.can_publish) {
    return NextResponse.json(
      { error: "Publication capability is required for this validation." },
      { status: 409 }
    );
  }

  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const assetId = `storage-e2e-${crypto.randomUUID()}`;
  const source = `${user.id}/${site.id}/library/${assetId}.txt`;
  const privateRef = `private://${source}`;
  const expectedBody = `AJG Site Builder Storage E2E ${crypto.randomUUID()}`;
  let destination = "";
  let stage = "private-upload";
  let privatePublicStatus = 0;
  let promotedPublicStatus = 0;
  let failure = "";

  try {
    const { error: uploadError } = await service.storage
      .from("site-private-media")
      .upload(source, expectedBody, {
        contentType: "text/plain",
        cacheControl: "60",
        upsert: false
      });
    if (uploadError) throw uploadError;

    stage = "private-download";
    const { data: privateBlob, error: privateDownloadError } = await service.storage
      .from("site-private-media")
      .download(source);
    if (privateDownloadError || !privateBlob) {
      throw privateDownloadError || new Error("Private object could not be read.");
    }
    if ((await privateBlob.text()) !== expectedBody) {
      throw new Error("Private object content mismatch.");
    }

    stage = "private-public-block";
    const privatePublicUrl =
      `${url}/storage/v1/object/public/site-private-media/${encodedObjectPath(source)}`;
    const privatePublicResponse = await fetch(privatePublicUrl, {
      cache: "no-store",
      redirect: "manual"
    });
    privatePublicStatus = privatePublicResponse.status;
    if (privatePublicResponse.ok) {
      throw new Error("Private object was unexpectedly reachable without authentication.");
    }

    stage = "promotion-route";
    const promotionResponse = await fetch(new URL("/api/media/promote", request.url), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        siteId: site.id,
        privateRef,
        assetId,
        rights: "owned"
      }),
      cache: "no-store"
    });
    const promotion = await promotionResponse.json().catch(() => null);
    if (!promotionResponse.ok || typeof promotion?.url !== "string" || typeof promotion?.path !== "string") {
      throw new Error(`Promotion route failed with HTTP ${promotionResponse.status}.`);
    }
    destination = promotion.path;

    stage = "public-fetch";
    const publicResponse = await fetch(promotion.url, {
      cache: "no-store",
      redirect: "follow"
    });
    promotedPublicStatus = publicResponse.status;
    if (!publicResponse.ok) {
      throw new Error(`Promoted object returned HTTP ${publicResponse.status}.`);
    }
    if ((await publicResponse.text()) !== expectedBody) {
      throw new Error("Promoted object content mismatch.");
    }

    stage = "event-record";
    await service.from("product_events").insert({
      user_id: user.id,
      site_id: site.id,
      event_name: "storage_private_public_e2e_passed"
    });
  } catch {
    failure = stage;
  }

  const cleanupTargets = [
    service.storage.from("site-private-media").remove([source]),
    destination
      ? service.storage.from("site-media").remove([destination])
      : Promise.resolve({ error: null })
  ];
  const cleanup = await Promise.all(cleanupTargets);
  const cleanupOk = cleanup.every((result) => !result.error);

  if (failure) {
    return NextResponse.json(
      {
        error: "Storage E2E validation failed",
        stage: failure,
        cleanupOk
      },
      {
        status: 500,
        headers: { "Cache-Control": "private, no-store" }
      }
    );
  }

  if (!cleanupOk) {
    return NextResponse.json(
      {
        error: "Storage E2E validation passed but cleanup failed",
        stage: "cleanup"
      },
      {
        status: 500,
        headers: { "Cache-Control": "private, no-store" }
      }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      siteId: site.id,
      privateBucket: "site-private-media",
      privatePublicStatus,
      promotedPublicStatus,
      cleanupOk: true
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    }
  );
}
