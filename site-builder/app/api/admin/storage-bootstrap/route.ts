import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearer(request: Request) {
  const value = request.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !publishable || !serviceKey) {
    return NextResponse.json(
      { error: "Server storage configuration missing" },
      { status: 503 }
    );
  }

  const token = bearer(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userClient = createClient(url, publishable, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser(token);
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

  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: existing, error: getError } = await service.storage.getBucket(
    "site-private-media"
  );

  if (existing) {
    return NextResponse.json(
      { ok: true, created: false, bucket: "site-private-media" },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  if (getError && !/not found/i.test(getError.message || "")) {
    const { data: buckets, error: listError } = await service.storage.listBuckets();
    if (listError) {
      return NextResponse.json({ error: "Unable to inspect storage" }, { status: 503 });
    }
    if (buckets?.some((bucket) => bucket.id === "site-private-media")) {
      return NextResponse.json(
        { ok: true, created: false, bucket: "site-private-media" },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }
  }

  const { error: createError } = await service.storage.createBucket(
    "site-private-media",
    {
      public: false,
      allowedMimeTypes: [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/avif",
        "audio/mpeg",
        "audio/mp4",
        "audio/ogg",
        "audio/wav",
        "application/pdf",
        "text/plain"
      ],
      fileSizeLimit: "15MB"
    }
  );

  if (createError) {
    const { data: racedBucket } = await service.storage.getBucket("site-private-media");
    if (!racedBucket) {
      return NextResponse.json(
        { error: "Unable to create private storage" },
        { status: 503 }
      );
    }
  }

  const { data: verified, error: verifyError } = await service.storage.getBucket(
    "site-private-media"
  );

  if (verifyError || !verified || verified.public) {
    return NextResponse.json(
      { error: "Private storage verification failed" },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { ok: true, created: true, bucket: "site-private-media" },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
